"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Loader2,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

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

interface CheckpointData {
  lead_intent?: string;
  sentiment?: "positive" | "neutral" | "negative";
  summary?: string;
  commitments?: string[];
  unresolved_objections?: string[];
  next_step?: string;
}

interface DealData {
  id: string;
  title: string;
  value_cents: number;
  currency: string;
  status: string;
  stage?: {
    id: string;
    name: string;
    color: string;
    position: number;
  };
}

export function InboxVisitorDetails({
  botId,
  sessionId,
  fetchBackend,
  formatDateTime,
  onClose,
  onSelectConversation,
  actions,
}: {
  botId: string;
  sessionId: string;
  fetchBackend: (path: string, options?: RequestInit) => Promise<Response>;
  formatDateTime: (value: string) => string;
  onClose: () => void;
  onSelectConversation?: (sessionId: string) => void;
  actions?: React.ReactNode;
}) {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [checkpoint, setCheckpoint] = useState<CheckpointData | null>(null);
  const [deal, setDeal] = useState<DealData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setVisitor(null);
    setCheckpoint(null);
    setDeal(null);
    setLoading(true);
    setError(false);

    async function load() {
      try {
        const response = await fetchBackend(
          `/api/admin/inbox/visitor?bot_id=${encodeURIComponent(botId)}&session_id=${encodeURIComponent(sessionId)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Visitor details unavailable");
        const body: { visitor: Visitor } = await response.json();
        if (!controller.signal.aborted) setVisitor(body.visitor);

        // Fetch Cognitive Checkpoint (non-blocking)
        try {
          const cpRes = await fetchBackend(
            `/api/enterprise/checkpoints/${encodeURIComponent(sessionId)}?bot_id=${encodeURIComponent(botId)}`,
            { signal: controller.signal }
          );
          if (cpRes.ok) {
            const cpBody = await cpRes.json();
            if (!controller.signal.aborted && cpBody.checkpoint && Object.keys(cpBody.checkpoint).length > 0) {
              setCheckpoint(cpBody.checkpoint);
            }
          }
        } catch {
          // ignore non-critical checkpoint failure
        }

        // Fetch Deal associated with this session (non-blocking)
        try {
          const dealRes = await fetchBackend(
            `/api/enterprise/deals/by-session/${encodeURIComponent(sessionId)}?bot_id=${encodeURIComponent(botId)}`,
            { signal: controller.signal }
          );
          if (dealRes.ok) {
            const dealBody = await dealRes.json();
            if (!controller.signal.aborted && dealBody.deal) {
              setDeal(dealBody.deal);
            }
          }
        } catch {
          // ignore non-critical deal lookup failure
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [botId, sessionId, fetchBackend, attempt]);

  const rows = visitor
    ? [
        ["Channel", visitor.channel],
        ["Conversation started", visitor.first_seen_at ? formatDateTime(visitor.first_seen_at) : null],
        ["Last message", visitor.last_seen_at ? formatDateTime(visitor.last_seen_at) : null],
      ]
    : [];

  return (
    <section
      aria-label="Visitor details"
      className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 text-xs shrink-0 max-h-72 overflow-y-auto"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <UserRound className="size-4 shrink-0" />
          Visitor details
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close visitor details"
          className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <X className="size-4" />
        </button>
      </div>

      {loading ? (
        <p role="status" className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="size-4 animate-spin" />
          Loading visitor details…
        </p>
      ) : error ? (
        <div role="alert" className="flex items-center gap-2 text-red-500">
          <AlertCircle className="size-4 shrink-0" />
          <span>Could not load visitor details.</span>
          <button type="button" className="underline whitespace-nowrap" onClick={() => setAttempt((v) => v + 1)}>
            Retry
          </button>
        </div>
      ) : (
        visitor && (
          <>
            <div className="inbox-contact-avatar" aria-hidden="true">
              {(visitor.name || "Anonymous visitor")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <p className="font-medium mb-1">{visitor.name || "Anonymous visitor"}</p>
            <div className="inbox-contact-summary">
              <p>
                <span>Email</span>
                <span>{visitor.email || "Not provided"}</span>
              </p>
              <p>
                <span>Phone</span>
                <span>{visitor.phone || "Not provided"}</span>
              </p>
              <p>
                <span>Location</span>
                <span>
                  {[visitor.location.city, visitor.location.region, visitor.location.country]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </span>
              </p>
            </div>
            <p className="text-neutral-500 mb-3">
              {visitor.identity_verified
                ? "Identity verified by your website server"
                : visitor.identity_status === "anonymous"
                ? "No contact details provided"
                : "Self-reported contact details · not verified identity"}
            </p>

            {/* ── Actions ── */}
            {actions && (
              <details className="inbox-contact-section" open>
                <summary>Actions</summary>
                <div className="inbox-contact-actions">{actions}</div>
              </details>
            )}

            {/* ── Enterprise CRM Deal ── */}
            <details className="inbox-contact-section" open>
              <summary className="flex items-center gap-1.5 font-semibold cursor-pointer">
                <Briefcase className="size-3.5 text-blue-500" />
                CRM Deal & Pipeline
              </summary>
              <div className="py-2.5 px-1 space-y-2">
                {deal ? (
                  <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {deal.title}
                      </span>
                      {deal.stage && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: deal.stage.color || "#3b82f6" }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <DollarSign className="size-3" />
                        {(deal.value_cents / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: deal.currency || "USD",
                        })}
                      </span>
                      <span className="capitalize px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                        {deal.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-400 dark:text-neutral-500 italic py-1">
                    No pipeline deal active for this session yet.
                  </p>
                )}
              </div>
            </details>

            {/* ── Enterprise Cognitive Intelligence ── */}
            {checkpoint && (
              <details className="inbox-contact-section" open>
                <summary className="flex items-center gap-1.5 font-semibold cursor-pointer">
                  <BrainCircuit className="size-3.5 text-purple-500" />
                  Cognitive Intelligence
                </summary>
                <div className="py-2.5 px-1 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {checkpoint.lead_intent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 capitalize">
                        Intent: {checkpoint.lead_intent.replace("_", " ")}
                      </span>
                    )}
                    {checkpoint.sentiment && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          checkpoint.sentiment === "positive"
                            ? "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400"
                            : checkpoint.sentiment === "negative"
                            ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                        }`}
                      >
                        Sentiment: {checkpoint.sentiment}
                      </span>
                    )}
                  </div>

                  {checkpoint.summary && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-300 bg-neutral-100/70 dark:bg-neutral-900/70 p-2 rounded-md">
                      <span className="font-semibold block text-[10px] text-neutral-400 uppercase tracking-wider mb-0.5">
                        Executive Summary
                      </span>
                      {checkpoint.summary}
                    </div>
                  )}

                  {checkpoint.commitments && checkpoint.commitments.length > 0 && (
                    <div>
                      <span className="font-semibold block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-500" />
                        Commitments Made
                      </span>
                      <ul className="space-y-1">
                        {checkpoint.commitments.map((cmt, idx) => (
                          <li key={idx} className="text-[11px] text-neutral-600 dark:text-neutral-300 flex items-start gap-1.5">
                            <span className="size-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span>{cmt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {checkpoint.unresolved_objections && checkpoint.unresolved_objections.length > 0 && (
                    <div>
                      <span className="font-semibold block text-[10px] text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <AlertTriangle className="size-3 text-amber-500" />
                        Unresolved Objections
                      </span>
                      <ul className="space-y-1">
                        {checkpoint.unresolved_objections.map((obj, idx) => (
                          <li key={idx} className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                            <span className="size-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {checkpoint.next_step && (
                    <div className="p-2 rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/40">
                      <span className="font-semibold block text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Recommended Next Step
                      </span>
                      <p className="text-[11px] text-purple-900 dark:text-purple-200 font-medium">
                        {checkpoint.next_step}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* ── Information ── */}
            <details className="inbox-contact-section" open>
              <summary>Information</summary>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-neutral-500">{label}</dt>
                    <dd className="min-w-0 break-words">{value || "Not provided"}</dd>
                  </div>
                ))}
                <dt className="text-neutral-500">Conversation ID</dt>
                <dd className="min-w-0 break-all font-mono">{visitor.session_id}</dd>
                {visitor.external_user_id && (
                  <>
                    <dt>Website user ID</dt>
                    <dd className="break-all">{visitor.external_user_id}</dd>
                  </>
                )}
              </dl>
            </details>

            {/* ── Contact Attributes ── */}
            <details className="inbox-contact-section" open>
              <summary>Contact attributes</summary>
              <dl>
                {Object.entries(visitor.custom_attributes || {}).map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt className="break-words">{key}</dt>
                    <dd className="break-words">{String(value ?? "Not provided")}</dd>
                  </React.Fragment>
                ))}
              </dl>
              {!Object.keys(visitor.custom_attributes || {}).length && (
                <p className="text-neutral-500 py-2">No custom attributes provided.</p>
              )}
            </details>

            {/* ── Previous Conversations ── */}
            <details className="inbox-contact-section" open>
              <summary>Previous conversations</summary>
              {visitor.previous_conversations?.length ? (
                visitor.previous_conversations.map((conversation) => (
                  <button
                    key={conversation.session_id}
                    type="button"
                    className="block text-left underline py-1"
                    onClick={() => onSelectConversation?.(conversation.session_id)}
                  >
                    {conversation.channel === "voice" ? "Voice" : "Text"} · {conversation.status} ·{" "}
                    {conversation.last_message_at
                      ? formatDateTime(conversation.last_message_at)
                      : conversation.session_id}
                  </button>
                ))
              ) : (
                <p className="text-neutral-500 py-2">No other authorized conversations.</p>
              )}
            </details>
          </>
        )
      )}
    </section>
  );
}
