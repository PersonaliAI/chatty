"use client";

import { Mail, Link2, RefreshCw, Loader2, Bell } from "lucide-react";
import type { AdminNotification } from "../dashboard-types";

interface NotificationsTabProps {
  notificationEmails: string;
  setNotificationEmails: (val: string) => void;
  handleInputChange: (setter: (v: string) => void, val: string) => void;
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  botId: string;
  loadAdminData: (id: string) => Promise<void>;
  loadingAdminData: boolean;
  adminNotifications: AdminNotification[];
  formatDateTime: (dt: string) => string;
}

export function NotificationsTab({
  notificationEmails,
  setNotificationEmails,
  handleInputChange,
  webhookUrl,
  setWebhookUrl,
  botId,
  loadAdminData,
  loadingAdminData,
  adminNotifications,
  formatDateTime,
}: NotificationsTabProps) {
  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
      <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Mail className="size-4 text-[#f97316]" /> Support Team Notification Emails
        </h3>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
          Enter comma-separated email addresses to receive instant alerts when a visitor starts a chat, files an offline ticket, or requests human support escalation.
        </p>
        <input
          type="text"
          value={notificationEmails}
          onChange={(e) => handleInputChange(setNotificationEmails, e.target.value)}
          placeholder="support@company.com, alex@company.com, escalation@company.com"
          className="w-full mt-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
        />
      </div>

      <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Link2 className="size-4 text-[#f97316]" /> Outbound Webhook
        </h3>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
          Get a POST request whenever this bot starts a new conversation or captures a new lead - wire it into Zapier, Slack, or your own backend.
        </p>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => handleInputChange(setWebhookUrl, e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          className="w-full mt-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
        />
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">
          Payload: <code className="font-mono">{"{ event: \"new_conversation\" | \"new_lead\", bot_id, data, timestamp }"}</code>. Remember to click <b>Save Changes</b>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Automated Notification Logs</h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Delivery reports for automated client meeting confirmations and administrator alerts.
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
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Channel</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Recipient</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Subject / Content</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
              {adminNotifications.map((n) => (
                <tr key={n.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {n.channel === "email" ? (
                        <Mail className="size-4 text-blue-500" />
                      ) : (
                        <Bell className="size-4 text-amber-500" />
                      )}
                      <span className="capitalize">{n.channel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono truncate max-w-[150px]" title={n.recipient}>
                    {n.recipient}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="font-semibold text-neutral-900 dark:text-white truncate">
                      {n.subject || "Alert Notification"}
                    </div>
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                      {n.content}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        n.status === "delivered" || n.status === "sent"
                          ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                          : "bg-red-50 text-red-755 dark:bg-red-950/20 dark:text-red-400"
                      }`}
                    >
                      {n.status}
                    </span>
                    {n.error_message && (
                      <div className="text-[9px] text-red-500 font-medium mt-1 leading-normal max-w-[140px] truncate">
                        {n.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-neutral-400 dark:text-neutral-500 font-mono">
                    {n.created_at ? formatDateTime(n.created_at) : ""}
                  </td>
                </tr>
              ))}

              {adminNotifications.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center space-y-2 text-neutral-400">
                    <Bell className="size-8 mx-auto text-neutral-300" />
                    <h5 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">No notifications sent yet</h5>
                    <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-normal">
                      Notification logs will populate once clients book meetings or updates are triggered.
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
