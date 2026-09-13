"use client";

import { Mail, RefreshCw } from "lucide-react";
import type { AdminNotification } from "../dashboard-types";

interface MailboxTabProps {
  adminNotifications: AdminNotification[];
  mailboxFilter: "all" | "client" | "admin";
  setMailboxFilter: (f: "all" | "client" | "admin") => void;
  selectedMailId: string | null;
  setSelectedMailId: (id: string | null) => void;
  botId: string;
  loadAdminData: (id: string) => Promise<void>;
  loadingAdminData: boolean;
  formatDateTime: (dt: string) => string;
}

export function MailboxTab({
  adminNotifications,
  mailboxFilter,
  setMailboxFilter,
  selectedMailId,
  setSelectedMailId,
  botId,
  loadAdminData,
  loadingAdminData,
  formatDateTime,
}: MailboxTabProps) {
  const emails = adminNotifications
    .filter((n) => n.channel === "email")
    .filter((n) => mailboxFilter === "all" || n.type === mailboxFilter);
  const selected = emails.find((m) => m.id === selectedMailId) || emails[0] || null;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      sent: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
      sent_gmail: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
      logged: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    };
    const label = s === "sent_gmail" ? "sent (gmail)" : s === "logged" ? "logged only" : s;
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${map[s] || "bg-neutral-100 text-neutral-500"}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto w-full py-6 px-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Mail className="size-3.5" /> Mailbox
          </h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Beautiful confirmation emails sent to clients and admins when a meeting is booked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-neutral-50 dark:bg-neutral-955 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800">
            {(["all", "client", "admin"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setMailboxFilter(f);
                  setSelectedMailId(null);
                }}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                  mailboxFilter === f
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => botId && loadAdminData(botId)}
            className="flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loadingAdminData ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Mail className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <p className="text-xs font-semibold text-neutral-500 mt-3">No emails yet</p>
          <p className="text-[10px] text-neutral-400 mt-1">
            When a visitor books a meeting, client &amp; admin confirmation emails will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Email list */}
          <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-850 max-h-[600px] overflow-y-auto">
            {emails.map((m) => {
              const isSel = selected && m.id === selected.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMailId(m.id)}
                  className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                    isSel
                      ? "bg-[#f97316]/5 border-l-2 border-l-[#f97316]"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-850/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        m.type === "admin"
                          ? "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400"
                          : "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                      }`}
                    >
                      {m.type}
                    </span>
                    {statusBadge(m.status || "")}
                  </div>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1.5 truncate">
                    {m.subject}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">To: {m.recipient}</p>
                  {m.created_at && <p className="text-[9px] text-neutral-400 mt-1">{formatDateTime(m.created_at)}</p>}
                </button>
              );
            })}
          </div>

          {/* Email preview */}
          <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
            {selected ? (
              <>
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-850">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{selected.subject}</h5>
                    {statusBadge(selected.status || "")}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400">
                    <span>
                      To: <span className="text-neutral-600 dark:text-neutral-300 font-medium">{selected.recipient}</span>
                    </span>
                    <span className="capitalize">· {selected.type} notification</span>
                    {selected.created_at && <span>· {formatDateTime(selected.created_at)}</span>}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-950">
                  {selected.html_content ? (
                    <iframe
                      title="email-preview"
                      sandbox=""
                      srcDoc={selected.html_content}
                      className="w-full h-full min-h-[420px] border-0 bg-white"
                    />
                  ) : (
                    <pre className="p-5 text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed font-sans">
                      {selected.content}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
                Select an email to preview
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
