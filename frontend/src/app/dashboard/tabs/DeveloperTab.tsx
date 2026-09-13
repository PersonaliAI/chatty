"use client";

import { Puzzle, Check, Copy, Plus, Loader2, Cpu, ArrowRight, Link2 } from "lucide-react";
import { BACKEND_URL } from "@/lib/backend-client";
import type { ApiKey, Webhook } from "../dashboard-types";

export const WEBHOOK_EVENT_OPTIONS = [
  "lead.created",
  "message.user",
  "message.assistant",
  "session.started",
  "session.ended",
] as const;

interface DeveloperTabProps {
  apiKeys: ApiKey[];
  formatDateTime: (dt: string) => string;
  newApiKey: string | null;
  copiedApiKey: boolean;
  setCopiedApiKey: (b: boolean) => void;
  handleCreateApiKey: () => void;
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
}

export function DeveloperTab({
  apiKeys,
  formatDateTime,
  newApiKey,
  copiedApiKey,
  setCopiedApiKey,
  handleCreateApiKey,
  creatingApiKey,
  botId,
  handleRevokeApiKey,
  setActiveTab,
  newWebhookSecret,
  copiedWebhookSecret,
  setCopiedWebhookSecret,
  newWebhookUrl,
  setNewWebhookUrl,
  newWebhookEvents,
  setNewWebhookEvents,
  handleCreateWebhook,
  creatingWebhook,
  webhooks,
  loadingWebhooks,
  handleDeleteWebhook,
}: DeveloperTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Puzzle className="size-4 text-[#f97316]" /> Developer API
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
          Call your trained assistant programmatically from any app or backend. Generate an API key, then POST to the chat endpoint with a Bearer token.
        </p>
      </div>

      {/* Usage summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Total Requests</p>
          <p className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">
            {apiKeys.reduce((s, k) => s + (k.request_count || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Active Keys</p>
          <p className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">
            {apiKeys.filter((k) => !k.revoked).length}
          </p>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Last Activity</p>
          <p className="text-sm font-semibold mt-2 text-neutral-700 dark:text-neutral-300">
            {(() => {
              const t = apiKeys.map((k) => k.last_used_at).filter((v): v is string => Boolean(v)).sort();
              return t.length ? formatDateTime(t[t.length - 1]) : "-";
            })()}
          </p>
        </div>
      </div>

      {/* Newly created key (shown once) */}
      {newApiKey && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-2xl">
          <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
            <Check className="size-3.5" /> New key created - copy it now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 truncate">
              {newApiKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newApiKey);
                setCopiedApiKey(true);
                setTimeout(() => setCopiedApiKey(false), 2000);
              }}
              className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copiedApiKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiedApiKey ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            API Keys ({apiKeys.length})
          </h4>
          <button
            onClick={handleCreateApiKey}
            disabled={creatingApiKey || !botId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {creatingApiKey ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Generate Key
          </button>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
          {apiKeys.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No API keys yet. Generate one to start using the API.
            </div>
          ) : (
            apiKeys.map((k) => (
              <div key={k.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                      {k.key_prefix}••••••••
                    </code>
                    {k.revoked && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {(k.request_count || 0).toLocaleString()} requests
                    {k.last_used_at ? ` · last used ${formatDateTime(k.last_used_at)}` : " · never used"}
                    {k.created_at ? ` · created ${formatDateTime(k.created_at)}` : ""}
                  </p>
                </div>
                {!k.revoked && (
                  <button
                    onClick={() => handleRevokeApiKey(k.id)}
                    className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Endpoint docs */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Endpoints</h4>
        <div className="space-y-1.5">
          {[
            { m: "POST", p: "/api/v1/chat", d: "Send a message, get the assistant's reply" },
            { m: "GET", p: "/api/v1/bot", d: "Bot details (name, model, settings)" },
            { m: "GET", p: "/api/v1/leads", d: "List captured leads (?limit&offset)" },
            { m: "GET", p: "/api/v1/conversations", d: "Recent conversation messages (?limit)" },
            { m: "GET", p: "/api/v1/usage", d: "This key's usage stats" },
          ].map((e) => (
            <div key={e.p} className="flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] w-12 text-center ${
                  e.m === "POST"
                    ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                }`}
              >
                {e.m}
              </span>
              <code className="font-mono text-neutral-700 dark:text-neutral-300">{e.p}</code>
              <span className="text-[10px] text-neutral-400 truncate">- {e.d}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-neutral-400">
          Base URL: <code className="font-mono">{BACKEND_URL}</code> · Auth:{" "}
          <code className="font-mono">Authorization: Bearer &lt;your_api_key&gt;</code> · Rate limit: 60 requests/min per key.
        </p>
        <pre className="bg-neutral-950 text-neutral-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed">{`curl -X POST ${BACKEND_URL}/api/v1/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What are your business hours?"}'

# Response: { "reply": "...", "session_id": "..." }`}</pre>
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 pt-1">JavaScript</p>
        <pre className="bg-neutral-950 text-neutral-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed">{`const res = await fetch("${BACKEND_URL}/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "What are your business hours?" }),
});
const { reply, session_id } = await res.json();`}</pre>
      </div>

      {/* MCP navigation link */}
      <button
        type="button"
        onClick={() => setActiveTab("mcp")}
        className="w-full flex items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 text-left hover:border-[#f97316]/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Cpu className="size-5 text-[#f97316] shrink-0" />
          <div>
            <p className="text-xs font-bold text-neutral-900 dark:text-white">
              Prefer an AI agent instead of raw HTTP calls?
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              Connect Claude or any MCP client - see the MCP tab
            </p>
          </div>
        </div>
        <ArrowRight className="size-4 text-neutral-400 shrink-0" />
      </button>

      {/* Webhooks */}
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Link2 className="size-4 text-[#f97316]" /> Webhooks
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
          Get a signed HTTP POST to your own server whenever a lead is captured or a message is sent, instead of polling. Every request includes an{" "}
          <code className="font-mono">X-Chatty-Signature</code> header (HMAC-SHA256) - verify it with the secret shown below before trusting the payload.
        </p>
      </div>

      {newWebhookSecret && (
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 rounded-2xl">
          <p className="text-[11px] font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
            <Check className="size-3.5" /> Webhook registered - copy the signing secret now, it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-[11px] font-mono bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 truncate">
              {newWebhookSecret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newWebhookSecret);
                setCopiedWebhookSecret(true);
                setTimeout(() => setCopiedWebhookSecret(false), 2000);
              }}
              className="px-3 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              {copiedWebhookSecret ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiedWebhookSecret ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Add a webhook</h4>
          <input
            type="url"
            value={newWebhookUrl}
            onChange={(e) => setNewWebhookUrl(e.target.value)}
            placeholder="https://your-server.com/chatty-webhook"
            className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
          />
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENT_OPTIONS.map((ev) => {
              const checked = newWebhookEvents.includes(ev);
              return (
                <button
                  key={ev}
                  type="button"
                  onClick={() =>
                    setNewWebhookEvents((prev) => (checked ? prev.filter((e) => e !== ev) : [...prev, ev]))
                  }
                  className={`text-[10px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    checked
                      ? "bg-[#f97316]/10 border-[#f97316]/40 text-[#f97316]"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-350"
                  }`}
                >
                  {ev}
                </button>
              );
            })}
          </div>
          <button
            onClick={handleCreateWebhook}
            disabled={creatingWebhook || !botId || !newWebhookUrl.trim() || newWebhookEvents.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {creatingWebhook ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add Webhook
          </button>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
          {webhooks.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              {loadingWebhooks ? "Loading…" : "No webhooks yet. Add one above to get real-time events."}
            </div>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <code className="text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate block">
                    {w.url}
                  </code>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(w.events || []).map((ev: string) => (
                      <span
                        key={ev}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5">
                    {w.created_at ? `Created ${formatDateTime(w.created_at)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteWebhook(w.id)}
                  className="px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <p className="text-[10px] text-neutral-400 -mt-3">
        Full event/payload/retry reference in the{" "}
        <a
          href="https://docs.chatty.personaliai.com/guides/webhooks"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          webhooks docs
        </a>
        .
      </p>
    </div>
  );
}
