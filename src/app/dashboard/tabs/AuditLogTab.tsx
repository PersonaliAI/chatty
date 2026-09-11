"use client";

import { RefreshCw, Loader2, FileText } from "lucide-react";
import type { AdminAuditLog } from "../dashboard-types";

interface AuditLogTabProps {
  botId: string;
  adminAuditLogs: AdminAuditLog[];
  loadingAdminData: boolean;
  loadAdminData: (id: string) => Promise<void>;
  formatDateTime: (dt: string) => string;
}

export function AuditLogTab({
  botId,
  adminAuditLogs,
  loadingAdminData,
  loadAdminData,
  formatDateTime,
}: AuditLogTabProps) {
  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">System Audit Logs</h4>
          <p className="text-[10px] text-neutral-455 dark:text-neutral-550 mt-1">
            Immutable ledger of administrative actions, data syncing, and configuration updates.
          </p>
        </div>
        <button
          onClick={() => loadAdminData(botId || "")}
          className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-855 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {loadingAdminData ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
            <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
              <tr>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Action Type</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Event Details</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Performed By</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
              {adminAuditLogs.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                  <td className="px-6 py-4">
                    <span className="font-bold text-neutral-900 dark:text-white capitalize">
                      {(a.action || "").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600 dark:text-neutral-300 leading-normal max-w-sm">
                    {a.details}
                  </td>
                  <td className="px-6 py-4 font-mono text-neutral-400 dark:text-neutral-500">
                    {a.performed_by}
                  </td>
                  <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">
                    {a.created_at ? formatDateTime(a.created_at) : ""}
                  </td>
                </tr>
              ))}

              {adminAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center space-y-2 text-neutral-400">
                    <FileText className="size-8 mx-auto text-neutral-300" />
                    <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No activity logged yet</h5>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                      Administrative configuration actions will be audited and listed here.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
