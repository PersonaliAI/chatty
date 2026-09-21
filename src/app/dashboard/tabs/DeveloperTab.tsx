"use client";

import { useState, useCallback } from "react";
import {
  Puzzle, Check, Copy, Plus, Loader2, Cpu, ArrowRight, Link2,
  Code2, ChevronDown, ChevronRight, Shield, Globe, Zap,
  AlertTriangle, RefreshCw, Clock, Activity, Terminal,
  BookOpen, ExternalLink, Trash2, Edit2, X,
} from "lucide-react";
import { BACKEND_URL } from "@/lib/backend-client";
import type { ApiKey, Webhook } from "../dashboard-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENT_CATEGORIES: Record<string, string[]> = {
  "Session": ["session.started", "session.ended", "session.assigned", "session.resolved", "session.transferred"],
  "Messages": ["message.user", "message.assistant", "message.agent"],
  "Leads": ["lead.created", "lead.updated", "lead.exported"],
  "Meetings": ["meeting.booked", "meeting.cancelled", "meeting.rescheduled"],
  "SLA": ["sla.first_response_breached", "sla.resolution_breached"],
  "CSAT": ["csat.submitted"],
  "Knowledge": ["knowledge.source_added", "knowledge.source_deleted"],
};

export const WEBHOOK_EVENT_OPTIONS = Object.values(WEBHOOK_EVENT_CATEGORIES).flat() as string[];

const ALL_SCOPES = ["chat", "read", "write"] as const;
type Scope = typeof ALL_SCOPES[number];

const SCOPE_DESC: Record<Scope, string> = {
  chat: "Send messages and receive AI replies",
  read: "Read leads, conversations, analytics, knowledge sources",
  write: "Create / delete knowledge sources, register webhooks",
};

// ---------------------------------------------------------------------------
// Event payload schemas for the Event Catalog
// ---------------------------------------------------------------------------

const EVENT_SCHEMAS: Record<string, { description: string; example: object }> = {
  "session.started": {
    description: "Fired when a new visitor session opens (first message sent).",
    example: { event: "session.started", bot_id: "uuid", session_id: "sess_abc123", channel: "web", created_at: "2026-09-16T10:00:00Z" },
  },
  "session.ended": {
    description: "Fired when a session is closed by the visitor, the agent, or a timeout.",
    example: { event: "session.ended", bot_id: "uuid", session_id: "sess_abc123", closed_by: "visitor", created_at: "2026-09-16T10:15:00Z" },
  },
  "session.assigned": {
    description: "Fired when a session is assigned to a human agent.",
    example: { event: "session.assigned", bot_id: "uuid", session_id: "sess_abc123", agent_email: "support@company.com", created_at: "2026-09-16T10:02:00Z" },
  },
  "session.resolved": {
    description: "Fired when a session status is set to resolved.",
    example: { event: "session.resolved", bot_id: "uuid", session_id: "sess_abc123", resolved_by: "support@company.com", created_at: "2026-09-16T10:20:00Z" },
  },
  "session.transferred": {
    description: "Fired when a session is reassigned from one agent to another.",
    example: { event: "session.transferred", bot_id: "uuid", session_id: "sess_abc123", from_agent: "a@co.com", to_agent: "b@co.com", created_at: "2026-09-16T10:05:00Z" },
  },
  "message.user": {
    description: "Fired for every message sent by a visitor.",
    example: { event: "message.user", bot_id: "uuid", session_id: "sess_abc123", text: "What are your hours?", created_at: "2026-09-16T10:01:00Z" },
  },
  "message.assistant": {
    description: "Fired for every AI-generated reply.",
    example: { event: "message.assistant", bot_id: "uuid", session_id: "sess_abc123", text: "We're open Monday to Friday, 9am–6pm.", model: "gemini-2.5-flash", created_at: "2026-09-16T10:01:02Z" },
  },
  "message.agent": {
    description: "Fired when a human agent sends a reply.",
    example: { event: "message.agent", bot_id: "uuid", session_id: "sess_abc123", text: "Hi! Let me look into that.", agent_email: "support@company.com", created_at: "2026-09-16T10:03:00Z" },
  },
  "lead.created": {
    description: "Fired when the AI captures a new lead (name, email, or phone).",
    example: { event: "lead.created", bot_id: "uuid", session_id: "sess_abc123", lead: { name: "Jane Doe", email: "jane@example.com", phone: "+1555000" }, created_at: "2026-09-16T10:04:00Z" },
  },
  "lead.updated": {
    description: "Fired when an existing lead's details are updated from the dashboard.",
    example: { event: "lead.updated", bot_id: "uuid", lead_id: "uuid", changes: { company: "Acme Inc" }, created_at: "2026-09-16T10:10:00Z" },
  },
  "lead.exported": {
    description: "Fired when leads are exported to CSV from the dashboard.",
    example: { event: "lead.exported", bot_id: "uuid", count: 142, exported_by: "owner@company.com", created_at: "2026-09-16T10:30:00Z" },
  },
  "meeting.booked": {
    description: "Fired when a visitor books a meeting through the AI.",
    example: { event: "meeting.booked", bot_id: "uuid", meeting_id: "uuid", attendee_email: "jane@example.com", start_time: "2026-09-18T14:00:00Z", provider: "google_calendar" },
  },
  "meeting.cancelled": {
    description: "Fired when a meeting is cancelled.",
    example: { event: "meeting.cancelled", bot_id: "uuid", meeting_id: "uuid", cancelled_by: "attendee", created_at: "2026-09-16T11:00:00Z" },
  },
  "meeting.rescheduled": {
    description: "Fired when a meeting is rescheduled to a new time.",
    example: { event: "meeting.rescheduled", bot_id: "uuid", meeting_id: "uuid", new_start: "2026-09-19T10:00:00Z", created_at: "2026-09-16T11:05:00Z" },
  },
  "sla.first_response_breached": {
    description: "Fired when the first-response SLA deadline is missed.",
    example: { event: "sla.first_response_breached", bot_id: "uuid", session_id: "sess_abc123", deadline: "2026-09-16T10:30:00Z", created_at: "2026-09-16T10:30:01Z" },
  },
  "sla.resolution_breached": {
    description: "Fired when the resolution SLA deadline is missed.",
    example: { event: "sla.resolution_breached", bot_id: "uuid", session_id: "sess_abc123", deadline: "2026-09-16T18:00:00Z", created_at: "2026-09-16T18:00:01Z" },
  },
  "csat.submitted": {
    description: "Fired when a visitor submits a post-chat star rating.",
    example: { event: "csat.submitted", bot_id: "uuid", session_id: "sess_abc123", rating: 5, comment: "Very helpful!", created_at: "2026-09-16T10:22:00Z" },
  },
  "knowledge.source_added": {
    description: "Fired when a new knowledge source is added or crawled.",
    example: { event: "knowledge.source_added", bot_id: "uuid", source_id: "uuid", type: "url", name: "https://docs.example.com", char_count: 24500 },
  },
  "knowledge.source_deleted": {
    description: "Fired when a knowledge source is deleted.",
    example: { event: "knowledge.source_deleted", bot_id: "uuid", source_id: "uuid", name: "Help Center", created_at: "2026-09-16T12:00:00Z" },
  },
};

// ---------------------------------------------------------------------------
// API endpoint catalog
// ---------------------------------------------------------------------------

interface EndpointDef {
  method: "GET" | "POST" | "DELETE" | "PATCH";
  path: string;
  scope: string;
  description: string;
  requestBody?: object;
  responseExample: object;
}

const API_ENDPOINTS: Record<string, EndpointDef[]> = {
  "Chat": [
    {
      method: "POST", path: "/api/v1/chat", scope: "chat",
      description: "Send a message and receive an AI reply. Pass session_id to continue an existing conversation.",
      requestBody: { text: "What are your business hours?", session_id: "optional-existing-session-id", visitor_timezone: "America/New_York" },
      responseExample: { reply: "We're open Monday–Friday, 9am–6pm EST.", session_id: "sess_abc123" },
    },
  ],
  "Bot": [
    {
      method: "GET", path: "/api/v1/bot", scope: "read",
      description: "Get public configuration details for the bot tied to this API key.",
      responseExample: { id: "uuid", name: "Support Bot", welcome_message: "Hi! How can I help?", selected_model: "gemini-2.5-flash", lead_capture_enabled: true },
    },
    {
      method: "GET", path: "/api/v1/usage", scope: "any",
      description: "Return usage statistics and configuration for the calling API key.",
      responseExample: { key_prefix: "chatty_sk_abc", scopes: ["chat", "read"], request_count: 1204, last_used_at: "2026-09-16T10:00:00Z", rate_limit_per_min: 60 },
    },
  ],
  "Leads": [
    {
      method: "GET", path: "/api/v1/leads", scope: "read",
      description: "List captured leads, most recent first. Supports ?limit=50&offset=0 pagination.",
      responseExample: { leads: [{ id: "uuid", name: "Jane Doe", email: "jane@example.com", created_at: "2026-09-16T10:04:00Z" }], total: 142, limit: 50, offset: 0 },
    },
  ],
  "Conversations": [
    {
      method: "GET", path: "/api/v1/conversations", scope: "read",
      description: "List recent messages across all sessions. Supports ?limit=50&offset=0.",
      responseExample: { messages: [{ id: "uuid", session_id: "sess_abc123", role: "user", content: "Hello", created_at: "2026-09-16T10:01:00Z" }], limit: 50, offset: 0 },
    },
    {
      method: "GET", path: "/api/v1/conversations/{session_id}", scope: "read",
      description: "Fetch all messages in a specific conversation thread.",
      responseExample: { session_id: "sess_abc123", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there!" }] },
    },
    {
      method: "DELETE", path: "/api/v1/conversations/{session_id}", scope: "write",
      description: "Delete all messages in a session. Irreversible.",
      responseExample: { success: true, session_id: "sess_abc123", deleted: true },
    },
  ],
  "Knowledge": [
    {
      method: "GET", path: "/api/v1/knowledge", scope: "read",
      description: "List all knowledge sources for this bot.",
      responseExample: { sources: [{ id: "uuid", type: "url", name: "https://docs.example.com", status: "trained", char_count: 24500 }] },
    },
    {
      method: "POST", path: "/api/v1/knowledge", scope: "write",
      description: "Add a text snippet or crawl a URL into the knowledge base.",
      requestBody: { type: "url", name: "Help Center", url: "https://help.example.com" },
      responseExample: { success: true, chars: 24500, source: { id: "uuid", type: "url", name: "Help Center", status: "trained" } },
    },
    {
      method: "DELETE", path: "/api/v1/knowledge/{source_id}", scope: "write",
      description: "Permanently delete a knowledge source.",
      responseExample: { success: true, deleted_id: "uuid" },
    },
  ],
  "Analytics": [
    {
      method: "GET", path: "/api/v1/analytics", scope: "read",
      description: "Return aggregated usage statistics. Filter with ?since=2026-09-01T00:00:00Z.",
      responseExample: { total_messages: 4820, user_messages: 2410, unique_sessions: 891, total_leads: 142, knowledge_sources: 8, knowledge_kb: 48 },
    },
  ],
  "Webhooks": [
    {
      method: "GET", path: "/api/v1/webhooks", scope: "read",
      description: "List all registered webhooks for this bot.",
      responseExample: { webhooks: [{ id: "uuid", url: "https://myapp.com/hook", events: ["lead.created", "session.started"], active: true }] },
    },
    {
      method: "POST", path: "/api/v1/webhooks", scope: "write",
      description: "Register a new webhook. The signing secret is returned once — store it.",
      requestBody: { url: "https://myapp.com/chatty-hook", events: ["lead.created", "session.started"] },
      responseExample: { id: "uuid", url: "https://myapp.com/chatty-hook", events: ["lead.created", "session.started"], secret: "whsec_..." },
    },
    {
      method: "DELETE", path: "/api/v1/webhooks/{webhook_id}", scope: "write",
      description: "Delete a webhook subscription.",
      responseExample: { success: true, deleted_id: "uuid" },
    },
  ],
};

// ---------------------------------------------------------------------------
// Code samples (5 languages)
// ---------------------------------------------------------------------------

function buildSamples(baseUrl: string, apiKey: string) {
  const key = apiKey || "YOUR_API_KEY";
  return {
    curl: `curl -X POST ${baseUrl}/api/v1/chat \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What are your business hours?"}'`,

    javascript: `const res = await fetch("${baseUrl}/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${key}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "What are your business hours?" }),
});
const { reply, session_id } = await res.json();
console.log(reply);`,

    python: `import requests

response = requests.post(
    "${baseUrl}/api/v1/chat",
    headers={"Authorization": "Bearer ${key}"},
    json={"text": "What are your business hours?"}
)
data = response.json()
print(data["reply"])`,

    node: `const axios = require("axios");

const { data } = await axios.post(
  "${baseUrl}/api/v1/chat",
  { text: "What are your business hours?" },
  { headers: { Authorization: "Bearer ${key}" } }
);
console.log(data.reply);`,

    php: `<?php
$ch = curl_init("${baseUrl}/api/v1/chat");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode(["text" => "What are your hours?"]),
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer ${key}",
    "Content-Type: application/json",
  ],
]);
$res = json_decode(curl_exec($ch), true);
echo $res["reply"];`,
  };
}

// ---------------------------------------------------------------------------
// Small UI primitives
// ---------------------------------------------------------------------------

type LangKey = "curl" | "javascript" | "python" | "node" | "php";

function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`flex items-center gap-1 ${size === "xs" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]"} font-semibold rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors cursor-pointer`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    POST: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-14 text-center shrink-0 ${colors[method] ?? "bg-neutral-100 text-neutral-600"}`}>
      {method}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: string }) {
  const colors: Record<string, string> = {
    chat: "bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400",
    read: "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
    write: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400",
    any: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    admin: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${colors[scope] ?? colors.any}`}>
      {scope}
    </span>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
        <span className="text-[#f97316]">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main props
// ---------------------------------------------------------------------------

interface DeveloperTabProps {
  apiKeys: ApiKey[];
  formatDateTime: (dt: string) => string;
  newApiKey: string | null;
  copiedApiKey: boolean;
  setCopiedApiKey: (b: boolean) => void;
  handleCreateApiKey: (name: string, scopes: string[], allowedIps: string) => void;
  creatingApiKey: boolean;
  botId: string | null;
  handleRevokeApiKey: (id: string) => void;
  setActiveTab: (tab: string) => void;
  newWebhookSecret: string | null;
  copiedWebhookSecret: boolean;
  setCopiedWebhookSecret: (b: boolean) => void;
  newWebhookUrl: string;
  setNewWebhookUrl: (u: string) => void;
  newWebhookEvents: string[];
  setNewWebhookEvents: React.Dispatch<React.SetStateAction<string[]>>;
  handleCreateWebhook: () => void;
  creatingWebhook: boolean;
  webhooks: Webhook[];
  loadingWebhooks: boolean;
  handleDeleteWebhook: (id: string) => void;
  authToken?: string;
}

// ---------------------------------------------------------------------------
// DeveloperTab
// ---------------------------------------------------------------------------

export function DeveloperTab({
  apiKeys, formatDateTime, newApiKey, copiedApiKey, setCopiedApiKey,
  handleCreateApiKey, creatingApiKey, botId, handleRevokeApiKey, setActiveTab,
  newWebhookSecret, copiedWebhookSecret, setCopiedWebhookSecret,
  newWebhookUrl, setNewWebhookUrl, newWebhookEvents, setNewWebhookEvents,
  handleCreateWebhook, creatingWebhook, webhooks, loadingWebhooks, handleDeleteWebhook,
  authToken = "",
}: DeveloperTabProps) {

  // --- Key creation state ---
  const [newKeyName, setNewKeyName] = useState("My Integration");
  const [newKeyScopes, setNewKeyScopes] = useState<Scope[]>(["chat", "read"]);
  const [newKeyIps, setNewKeyIps] = useState("");
  const [showCreateKey, setShowCreateKey] = useState(false);

  // --- API Explorer state ---
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [tryItKey, setTryItKey] = useState("");
  const [tryItBody, setTryItBody] = useState<Record<string, string>>({});
  const [tryItResponse, setTryItResponse] = useState<Record<string, { loading: boolean; data: unknown; status: number | null }>>({});

  // --- Language tab state ---
  const [codeTab, setCodeTab] = useState<LangKey>("curl");
  const firstActive = apiKeys.find(k => !k.revoked);
  const samples = buildSamples(BACKEND_URL, firstActive?.key_prefix ? `${firstActive.key_prefix}••••` : "");

  // --- Event catalog state ---
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // --- Webhook delivery log state ---
  const [deliveryWebhookId, setDeliveryWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const fetchDeliveries = useCallback(async (whId: string) => {
    if (!botId || !authToken) return;
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/webhooks/${whId}/deliveries?bot_id=${botId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } finally {
      setLoadingDeliveries(false);
    }
  }, [botId, authToken]);

  const openDeliveries = (whId: string) => {
    setDeliveryWebhookId(whId);
    setDeliveries([]);
    fetchDeliveries(whId);
  };

  // --- Try-It runner ---
  const runTryIt = async (ep: EndpointDef) => {
    const key = tryItKey || firstActive?.key_prefix || "";
    if (!key) return;
    const epKey = ep.path;
    setTryItResponse(prev => ({ ...prev, [epKey]: { loading: true, data: null, status: null } }));
    try {
      const isPost = ep.method === "POST";
      const res = await fetch(`${BACKEND_URL}${ep.path.replace("{session_id}", "test-session").replace("{source_id}", "test-source-id").replace("{webhook_id}", "test-webhook-id")}`, {
        method: ep.method,
        headers: { Authorization: `Bearer ${key}`, ...(isPost ? { "Content-Type": "application/json" } : {}) },
        ...(isPost && ep.requestBody ? { body: JSON.stringify(ep.requestBody) } : {}),
      });
      const data = await res.json().catch(() => null);
      setTryItResponse(prev => ({ ...prev, [epKey]: { loading: false, data, status: res.status } }));
    } catch (e) {
      setTryItResponse(prev => ({ ...prev, [epKey]: { loading: false, data: { error: String(e) }, status: null } }));
    }
  };

  const totalRequests = apiKeys.reduce((s, k) => s + (k.request_count || 0), 0);
  const activeKeys = apiKeys.filter(k => !k.revoked);

  const LANGS: { key: LangKey; label: string }[] = [
    { key: "curl", label: "cURL" },
    { key: "javascript", label: "JavaScript" },
    { key: "python", label: "Python" },
    { key: "node", label: "Node.js" },
    { key: "php", label: "PHP" },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-10">

      {/* Keep this surface focused on server-to-server API work. Embed and
          third-party setup live in Integrations, so this page starts with
          the credentials and runtime contract developers actually need. */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-white p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-orange-300 text-[10px] uppercase tracking-[0.18em] font-bold">
              <Globe className="size-3.5" /> Developer platform
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mt-2 tracking-tight">Build with the Chatty API</h2>
            <p className="text-xs text-neutral-400 mt-2 max-w-xl leading-relaxed">
              Manage keys, call the REST API, and receive signed events. Website embeds and app integrations are configured separately.
            </p>
          </div>
          <a href={`${BACKEND_URL}/docs`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white text-neutral-950 text-[11px] font-semibold hover:bg-orange-100 transition-colors shrink-0">
            <ExternalLink className="size-3.5" /> API reference
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
          {[
            { label: "Base URL", value: BACKEND_URL, icon: <Globe className="size-3.5" /> },
            { label: "Authentication", value: "Bearer API key", icon: <Shield className="size-3.5" /> },
            { label: "Events", value: "HMAC-SHA256", icon: <Link2 className="size-3.5" /> },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">{item.icon}{item.label}</p>
              <p className="text-[11px] font-mono text-neutral-200 truncate mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 1. API Keys ───────────────────────────────────────────────────── */}
      <Section title="API Keys" icon={<Shield className="size-4" />}>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Total Requests", value: totalRequests.toLocaleString() },
            { label: "Active Keys", value: activeKeys.length.toString() },
            { label: "Last Activity", value: (() => { const t = apiKeys.map(k => k.last_used_at).filter((v): v is string => !!v).sort(); return t.length ? formatDateTime(t[t.length - 1]) : "—"; })() },
          ].map(s => (
            <Card key={s.label} className="p-4">
              <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">{s.label}</p>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* New key banner */}
        {newApiKey && (
          <div className="p-4 mb-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-2xl">
            <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Check className="size-3.5" /> New key created — copy it now, it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 truncate">{newApiKey}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(newApiKey); setCopiedApiKey(true); setTimeout(() => setCopiedApiKey(false), 2000); }}
                className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {copiedApiKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedApiKey ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Keys list */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">API Keys ({apiKeys.length})</h4>
            <button
              type="button"
              onClick={() => setShowCreateKey(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer"
            >
              <Plus className="size-3.5" /> New Key
            </button>
          </div>

          {/* Create form */}
          {showCreateKey && (
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide block mb-1">Key Name</label>
                  <input
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production Integration"
                    className="w-full text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-[#f97316]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide block mb-1">IP Allowlist (optional)</label>
                  <input
                    value={newKeyIps}
                    onChange={e => setNewKeyIps(e.target.value)}
                    placeholder="1.2.3.4, 10.0.0.0/8"
                    className="w-full text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 focus:outline-none focus:border-[#f97316]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide block mb-2">Scopes</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SCOPES.map(s => {
                    const checked = newKeyScopes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewKeyScopes(prev => checked ? prev.filter(x => x !== s) : [...prev, s])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${checked ? "bg-[#f97316]/10 border-[#f97316]/40 text-[#f97316]" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-neutral-300"}`}
                      >
                        {checked && <Check className="size-3" />}
                        <code>{s}</code>
                        <span className="text-[9px] font-normal text-neutral-400 ml-1 hidden sm:inline">{SCOPE_DESC[s]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { handleCreateApiKey(newKeyName, newKeyScopes, newKeyIps); setShowCreateKey(false); }}
                  disabled={creatingApiKey || !botId || newKeyScopes.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {creatingApiKey ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Generate Key
                </button>
                <button type="button" onClick={() => setShowCreateKey(false)} className="px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-700 cursor-pointer">Cancel</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">No API keys yet. Click &ldquo;New Key&rdquo; to create one.</div>
            ) : (
              apiKeys.map(k => (
                <div key={k.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200">{k.key_prefix}••••••••</code>
                      {k.revoked && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">Revoked</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-[10px] text-neutral-400">
                        {(k.request_count || 0).toLocaleString()} requests{k.last_used_at ? ` · last used ${formatDateTime(k.last_used_at)}` : " · never used"}
                      </p>
                    </div>
                  </div>
                  {!k.revoked && (
                    <button
                      type="button"
                      onClick={() => handleRevokeApiKey(k.id)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Scope reference */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {ALL_SCOPES.map(s => (
            <div key={s} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
              <ScopeBadge scope={s} />
              <p className="text-[10px] text-neutral-400 mt-1">{SCOPE_DESC[s]}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 2. Interactive API Reference ──────────────────────────────────── */}
      <Section title="API Reference" icon={<BookOpen className="size-4" />}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              value={tryItKey}
              onChange={e => setTryItKey(e.target.value)}
              placeholder={firstActive ? `${firstActive.key_prefix}•••• (auto-filled from active key)` : "Paste your API key for Try-It"}
              className="w-full text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-[#f97316] pr-10"
            />
          </div>
          <a href={`${BACKEND_URL}/docs`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
            <ExternalLink className="size-3.5" /> OpenAPI Docs
          </a>
        </div>

        <div className="space-y-2">
          {Object.entries(API_ENDPOINTS).map(([group, endpoints]) => (
            <div key={group}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5 mt-4 first:mt-0">{group}</p>
              {endpoints.map(ep => {
                const epKey = ep.path;
                const isOpen = expandedEndpoint === epKey;
                const result = tryItResponse[epKey];
                return (
                  <div key={epKey} className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedEndpoint(isOpen ? null : epKey)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-left cursor-pointer"
                    >
                      <MethodBadge method={ep.method} />
                      <code className="text-xs font-mono text-neutral-700 dark:text-neutral-300 flex-1">{ep.path}</code>
                      <ScopeBadge scope={ep.scope} />
                      {isOpen ? <ChevronDown className="size-3.5 text-neutral-400 shrink-0" /> : <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 space-y-4 bg-neutral-50/50 dark:bg-neutral-950/30">
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">{ep.description}</p>

                        {ep.requestBody && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">Request Body</p>
                            <div className="relative group">
                              <pre className="bg-neutral-950 text-neutral-200 rounded-xl p-3 text-[11px] font-mono overflow-x-auto">{JSON.stringify(ep.requestBody, null, 2)}</pre>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyButton text={JSON.stringify(ep.requestBody, null, 2)} size="xs" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">Example Response</p>
                          <pre className="bg-neutral-950 text-green-400 rounded-xl p-3 text-[11px] font-mono overflow-x-auto">{JSON.stringify(ep.responseExample, null, 2)}</pre>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => runTryIt(ep)}
                            disabled={result?.loading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 disabled:opacity-60 cursor-pointer"
                          >
                            {result?.loading ? <Loader2 className="size-3 animate-spin" /> : <Terminal className="size-3" />}
                            Try It
                          </button>
                          <span className="text-[10px] text-neutral-400">Uses the API key above</span>
                        </div>

                        {result && !result.loading && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5 flex items-center gap-2">
                              Response
                              {result.status && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(result.status as number) < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {result.status}
                                </span>
                              )}
                            </p>
                            <pre className={`rounded-xl p-3 text-[11px] font-mono overflow-x-auto ${(result.status as number) < 300 ? "bg-neutral-950 text-green-400" : "bg-red-950/20 text-red-400"}`}>
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4. Code Samples (5 languages) ─────────────────────────────────── */}
      <Section title="Code Samples" icon={<Code2 className="size-4" />}>
        <div className="flex items-center gap-1 mb-4 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1 w-fit">
          {LANGS.map(l => (
            <button
              key={l.key}
              type="button"
              onClick={() => setCodeTab(l.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${codeTab === l.key ? "bg-white dark:bg-neutral-900 shadow text-[#f97316]" : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="relative group">
          <pre className="bg-neutral-950 text-neutral-100 rounded-2xl p-5 overflow-x-auto text-[11px] font-mono leading-relaxed">{samples[codeTab]}</pre>
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={samples[codeTab]} />
          </div>
        </div>
        <p className="text-[10px] text-neutral-400 mt-2">
          Base URL: <code className="font-mono">{BACKEND_URL}</code> · Rate limit: 60 req/min per key · HMAC: <code className="font-mono">X-Chatty-Signature</code>
        </p>
      </Section>

      {/* ── 5. MCP navigation link ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setActiveTab("mcp")}
        className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl p-5 text-left hover:border-purple-300 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Cpu className="size-5 text-purple-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-white">Prefer an AI agent instead of raw HTTP calls?</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">Connect Claude, Cursor or any MCP client — see the MCP tab</p>
          </div>
        </div>
        <ArrowRight className="size-4 text-neutral-400 shrink-0" />
      </button>

      {/* ── 6. Webhooks ───────────────────────────────────────────────────── */}
      <Section title="Webhooks" icon={<Link2 className="size-4" />}>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-2 mb-4 max-w-xl leading-relaxed">
          Get a signed HTTP POST whenever something happens in Chatty. Every delivery includes an{" "}
          <code className="font-mono text-[11px]">X-Chatty-Signature</code> header (HMAC-SHA256) — verify it with your signing secret before trusting the payload.
        </p>

        {newWebhookSecret && (
          <div className="p-4 mb-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-2xl">
            <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Check className="size-3.5" /> Webhook registered — copy the signing secret now, it won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 truncate">{newWebhookSecret}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(newWebhookSecret); setCopiedWebhookSecret(true); setTimeout(() => setCopiedWebhookSecret(false), 2000); }}
                className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {copiedWebhookSecret ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedWebhookSecret ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Add webhook form */}
        <Card className="overflow-hidden mb-4">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Register Webhook</h4>
            <input
              type="url"
              value={newWebhookUrl}
              onChange={e => setNewWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/chatty-webhook"
              className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-[#f97316]"
            />

            {/* Event picker — grouped */}
            <div className="space-y-2 mb-3">
              {Object.entries(WEBHOOK_EVENT_CATEGORIES).map(([cat, events]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{cat}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = events.every(e => newWebhookEvents.includes(e));
                        setNewWebhookEvents(prev => allChecked
                          ? prev.filter(e => !events.includes(e))
                          : [...new Set([...prev, ...events])]);
                      }}
                      className="text-[9px] text-[#f97316] hover:underline cursor-pointer"
                    >
                      {events.every(e => newWebhookEvents.includes(e)) ? "deselect all" : "select all"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {events.map(ev => {
                      const checked = newWebhookEvents.includes(ev);
                      return (
                        <button
                          key={ev}
                          type="button"
                          onClick={() => setNewWebhookEvents(prev => checked ? prev.filter(e => e !== ev) : [...prev, ev])}
                          className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors cursor-pointer ${checked ? "bg-[#f97316]/10 border-[#f97316]/40 text-[#f97316]" : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-neutral-300"}`}
                        >
                          {ev}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateWebhook}
                disabled={creatingWebhook || !botId || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {creatingWebhook ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add Webhook
              </button>
              <span className="text-[10px] text-neutral-400">{newWebhookEvents.length} event{newWebhookEvents.length !== 1 ? "s" : ""} selected</span>
            </div>
          </div>

          {/* Existing webhooks */}
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {webhooks.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">{loadingWebhooks ? "Loading…" : "No webhooks yet."}</div>
            ) : (
              webhooks.map(w => {
                const isExpanded = deliveryWebhookId === w.id;
                return (
                  <div key={w.id}>
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <code className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate block">{w.url}</code>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(w.events || []).map((ev: string) => (
                            <span key={ev} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">{ev}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1">{w.created_at ? `Created ${formatDateTime(w.created_at)}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => isExpanded ? setDeliveryWebhookId(null) : openDeliveries(w.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer"
                        >
                          <Activity className="size-3" /> Log
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWebhook(w.id)}
                          className="px-2.5 py-1.5 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Delivery log drawer */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Delivery Log</p>
                          <button type="button" onClick={() => fetchDeliveries(w.id)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                            <RefreshCw className={`size-3.5 ${loadingDeliveries ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                        {loadingDeliveries ? (
                          <div className="flex items-center gap-2 text-xs text-neutral-400"><Loader2 className="size-3.5 animate-spin" /> Loading…</div>
                        ) : deliveries.length === 0 ? (
                          <p className="text-xs text-neutral-400">No deliveries yet for this webhook.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] min-w-[560px]">
                              <thead>
                                <tr className="text-[9px] uppercase text-neutral-400">
                                  <th className="text-left py-1.5 pr-3 font-semibold">Time</th>
                                  <th className="text-left py-1.5 pr-3 font-semibold">Event</th>
                                  <th className="text-center py-1.5 px-2 font-semibold">Status</th>
                                  <th className="text-center py-1.5 px-2 font-semibold">HTTP</th>
                                  <th className="text-center py-1.5 px-2 font-semibold">Attempt</th>
                                  <th className="text-right py-1.5 pl-2 font-semibold">Latency</th>
                                </tr>
                              </thead>
                              <tbody>
                                {deliveries.map((d) => {
                                  const row = d as Record<string, unknown>;
                                  const ok = (row.status as string) === "delivered";
                                  return (
                                    <tr key={row.id as string} className="border-t border-neutral-100 dark:border-neutral-800">
                                      <td className="py-2 pr-3 text-neutral-500">{formatDateTime(row.created_at as string)}</td>
                                      <td className="py-2 pr-3 font-mono text-neutral-700 dark:text-neutral-300">{row.event_type as string}</td>
                                      <td className="py-2 px-2 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ok ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400"}`}>
                                          {ok ? "OK" : (row.status as string) || "fail"}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-center font-mono">{(row.http_status as number) || "—"}</td>
                                      <td className="py-2 px-2 text-center text-neutral-500">{row.attempt as number}</td>
                                      <td className="py-2 pl-2 text-right text-neutral-500">{row.latency_ms ? `${row.latency_ms}ms` : "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <p className="text-[10px] text-neutral-400">
          Full payload reference in the{" "}
          <a href="https://docs.chatty.personaliai.com/guides/webhooks" target="_blank" rel="noreferrer" className="underline">webhooks docs</a>.
        </p>
      </Section>

      {/* ── 7. Event Catalog ──────────────────────────────────────────────── */}
      <Section title="Event Catalog" icon={<Zap className="size-4" />}>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-2 mb-4">Full payload schema for all 20 webhook events.</p>
        <div className="space-y-1">
          {Object.entries(WEBHOOK_EVENT_CATEGORIES).map(([cat, events]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-4 mb-1.5 first:mt-0">{cat}</p>
              {events.map(ev => {
                const schema = EVENT_SCHEMAS[ev];
                const isOpen = expandedEvent === ev;
                return (
                  <div key={ev} className="border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden mb-1">
                    <button
                      type="button"
                      onClick={() => setExpandedEvent(isOpen ? null : ev)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-left cursor-pointer transition-colors"
                    >
                      <code className="text-[11px] font-mono font-semibold text-neutral-700 dark:text-neutral-300 flex-1">{ev}</code>
                      {isOpen ? <ChevronDown className="size-3.5 text-neutral-400 shrink-0" /> : <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />}
                    </button>
                    {isOpen && schema && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-950/30">
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">{schema.description}</p>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">Example Payload</p>
                          <div className="relative group">
                            <pre className="bg-neutral-950 text-green-400 rounded-xl p-3 text-[11px] font-mono overflow-x-auto">{JSON.stringify(schema.example, null, 2)}</pre>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <CopyButton text={JSON.stringify(schema.example, null, 2)} size="xs" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
