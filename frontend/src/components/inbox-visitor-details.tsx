"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, UserRound, X } from "lucide-react";

interface Visitor {
  session_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  identity_status: "anonymous" | "details_provided" | "verified";
  contact_id?: string;
  external_user_id?: string;
  custom_attributes?: Record<string, string | number | boolean | null>;
  previous_conversations?: Array<{ session_id: string; channel: string; last_message_at: string; status: string }>;
  identity_verified: boolean;
  channel: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  location: { country: string | null; region: string | null; city: string | null };
}

export function InboxVisitorDetails({ botId, sessionId, fetchBackend, formatDateTime, onClose, onSelectConversation, actions }: {
  botId: string;
  sessionId: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
  formatDateTime: (value: string) => string;
  onClose: () => void;
  onSelectConversation?: (sessionId: string) => void;
  actions?: React.ReactNode;
}) {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setVisitor(null);
    setLoading(true);
    setError(false);
    async function load() {
      try {
        const response = await fetchBackend(`/api/admin/inbox/visitor?bot_id=${encodeURIComponent(botId)}&session_id=${encodeURIComponent(sessionId)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Visitor details unavailable");
        const body: { visitor: Visitor } = await response.json();
        if (!controller.signal.aborted) setVisitor(body.visitor);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [botId, sessionId, fetchBackend, attempt]);

  const rows = visitor ? [
    ["Channel", visitor.channel],
    ["Conversation started", visitor.first_seen_at ? formatDateTime(visitor.first_seen_at) : null],
    ["Last message", visitor.last_seen_at ? formatDateTime(visitor.last_seen_at) : null],
  ] : [];

  return (
    <section aria-label="Visitor details" className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-xs shrink-0 max-h-72 overflow-y-auto">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2"><UserRound className="size-4 shrink-0" />Visitor details</h3>
        <button type="button" onClick={onClose} aria-label="Close visitor details" className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"><X className="size-4" /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Loading visitor details…</p> : error ? (
        <div role="alert" className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" /><span>Could not load visitor details.</span><button type="button" className="underline whitespace-nowrap" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>
      ) : visitor && (
        <>
          <div className="inbox-contact-avatar" aria-hidden="true">{(visitor.name || "Anonymous visitor").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</div>
          <p className="font-medium mb-1">{visitor.name || "Anonymous visitor"}</p>
          <div className="inbox-contact-summary">
            <p><span>Email</span><span>{visitor.email || "Not provided"}</span></p>
            <p><span>Phone</span><span>{visitor.phone || "Not provided"}</span></p>
            <p><span>Location</span><span>{[visitor.location.city, visitor.location.region, visitor.location.country].filter(Boolean).join(", ") || "Not provided"}</span></p>
          </div>
          <p className="text-neutral-500 mb-3">{visitor.identity_verified ? "Identity verified by your website server" : visitor.identity_status === "anonymous" ? "No contact details provided" : "Self-reported contact details · not verified identity"}</p>
          {actions && <details className="inbox-contact-section" open><summary>Actions</summary><div className="inbox-contact-actions">{actions}</div></details>}
          <details className="inbox-contact-section" open><summary>Information</summary><dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
            {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-neutral-500">{label}</dt><dd className="min-w-0 break-words">{value || "Not provided"}</dd></div>)}
            <dt className="text-neutral-500">Conversation ID</dt><dd className="min-w-0 break-all font-mono">{visitor.session_id}</dd>
            {visitor.external_user_id && <><dt>Website user ID</dt><dd className="break-all">{visitor.external_user_id}</dd></>}
          </dl></details>
          <details className="inbox-contact-section" open><summary>Contact attributes</summary><dl>{Object.entries(visitor.custom_attributes || {}).map(([key, value]) => <React.Fragment key={key}><dt className="break-words">{key}</dt><dd className="break-words">{String(value ?? "Not provided")}</dd></React.Fragment>)}</dl>{!Object.keys(visitor.custom_attributes || {}).length && <p className="text-neutral-500 py-2">No custom attributes provided.</p>}</details>
          <details className="inbox-contact-section" open><summary>Previous conversations</summary>{visitor.previous_conversations?.length ? visitor.previous_conversations.map(conversation => <button key={conversation.session_id} type="button" className="block text-left underline py-1" onClick={() => onSelectConversation?.(conversation.session_id)}>{conversation.channel === "voice" ? "Voice" : "Text"} · {conversation.status} · {conversation.last_message_at ? formatDateTime(conversation.last_message_at) : conversation.session_id}</button>) : <p className="text-neutral-500 py-2">No other authorized conversations.</p>}</details>
        </>
      )}
    </section>
  );
}
