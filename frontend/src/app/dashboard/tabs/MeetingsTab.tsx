"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  RefreshCw,
  Loader2,
  ExternalLink,
  Bot,
  Check,
  X,
  Calendar,
  Video,
  Copy,
  Phone,
  Mail,
  User,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ModernSelect } from "@/components/ui/modern-select";
import { colorForAssignee, colorForMeetingStatus } from "@/lib/meeting-colors";
import type { AdminMeeting } from "../dashboard-types";

const MeetingsCalendar = dynamic(
  () => import("@/components/meetings-calendar").then((m) => m.MeetingsCalendar),
  { ssr: false }
);

export interface TeamMemberLike {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  phone?: string;
}

interface MeetingsTabProps {
  myRole: string | null;
  adminMeetings: AdminMeeting[];
  meetingMemberFilter: string;
  setMeetingMemberFilter: (v: string) => void;
  selectedMeetingId: string | null;
  setSelectedMeetingId: (id: string | null) => void;
  teamMembers: TeamMemberLike[];
  botId: string | null;
  allBots?: { id: string; name: string }[];
  loadAdminData: (id: string) => Promise<void>;
  loadingAdminData: boolean;
  botTimezone: string;
  openMeetingPanel: (id: string) => void;
  formatDateTime: (dt: string) => string;
  reschedulingMeetingId: string | null;
  setReschedulingMeetingId: (id: string | null) => void;
  rescheduleDateTime: string;
  setRescheduleDateTime: (dt: string) => void;
  handleRescheduleMeeting: (m: AdminMeeting) => Promise<void>;
  reschedulingBusy: boolean;
  handleUpdateMeetingStatus: (id: string, status: string) => Promise<void>;
}

export function MeetingsTab({
  myRole,
  adminMeetings,
  meetingMemberFilter,
  setMeetingMemberFilter,
  selectedMeetingId,
  setSelectedMeetingId,
  teamMembers,
  botId,
  allBots = [],
  loadAdminData,
  loadingAdminData,
  botTimezone,
  openMeetingPanel,
  formatDateTime,
  reschedulingMeetingId,
  setReschedulingMeetingId,
  rescheduleDateTime,
  setRescheduleDateTime,
  handleRescheduleMeeting,
  reschedulingBusy,
  handleUpdateMeetingStatus,
}: MeetingsTabProps) {
  const [botFilter, setBotFilter] = useState<string>("all");
  const [copiedLink, setCopiedLink] = useState(false);
  const isAgentView = myRole === "agent";

  const assignees = Array.from(
    new Set(adminMeetings.map((m) => m.assigned_to_email).filter(Boolean))
  ) as string[];

  const filteredMeetings = adminMeetings.filter((m) => {
    if (!isAgentView && meetingMemberFilter !== "all" && m.assigned_to_email !== meetingMemberFilter) {
      return false;
    }
    if (botFilter !== "all" && m.bot_id && m.bot_id !== botFilter) {
      return false;
    }
    return true;
  });

  const selectedMeeting = adminMeetings.find((m) => m.id === selectedMeetingId) || null;

  const handleCopyLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getProviderLabel = (provider?: string) => {
    if (!provider) return "Video Conference";
    if (provider === "google_meet") return "Google Meet";
    if (provider === "microsoft_teams") return "Microsoft Teams";
    if (provider === "zoom") return "Zoom Video";
    return provider;
  };

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
      {/* Header & Multi-Bot / Host Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Scheduled Meetings</h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Unified calendar bookings across all bots and team host assignments.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isAgentView && allBots && allBots.length > 1 && (
            <div className="w-44">
              <ModernSelect
                size="sm"
                value={botFilter}
                options={[
                  { value: "all", label: "All Assistants" },
                  ...allBots.map((b) => ({ value: b.id, label: b.name })),
                ]}
                onChange={(val) => {
                  setBotFilter(val);
                  void loadAdminData(val);
                }}
              />
            </div>
          )}
          {!isAgentView && assignees.length > 1 && (
            <div className="w-44">
              <ModernSelect
                size="sm"
                value={meetingMemberFilter}
                options={[
                  { value: "all", label: "All Team Hosts" },
                  ...assignees.map((email) => ({
                    value: email,
                    label: teamMembers.find((m) => m.email === email)?.name || email,
                  })),
                ]}
                onChange={setMeetingMemberFilter}
              />
            </div>
          )}
          <button
            onClick={() => loadAdminData(botFilter || botId || "all")}
            className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Main FullCalendar Component */}
      {loadingAdminData ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <MeetingsCalendar
          meetings={filteredMeetings.map((m) => ({
            id: m.id,
            title: m.title,
            start_time: m.start_time,
            end_time: m.end_time,
            status: m.status,
            assigned_to_email: m.assigned_to_email,
            assigned_to_name:
              teamMembers.find((t) => t.email === m.assigned_to_email)?.name ||
              m.assigned_to_name ||
              m.assigned_to_email,
            bot_name: m.bot_name,
          }))}
          onSelectMeeting={openMeetingPanel}
          defaultTimezone={botTimezone || "UTC"}
        />
      )}

      {/* Selected Meeting Detail Card */}
      {selectedMeeting && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h5 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {selectedMeeting.title || "Meeting Appointment"}
                </h5>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {selectedMeeting.status}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                  <Bot className="size-2.5" />
                  {selectedMeeting.bot_name || "General Assistant"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <Clock className="size-3" />
                {formatDateTime(selectedMeeting.start_time)}
                {selectedMeeting.end_time && ` — ${formatDateTime(selectedMeeting.end_time).split(",")[1] || ""}`}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedMeetingId(null);
                setReschedulingMeetingId(null);
              }}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Close meeting details"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Details 3-Card Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Host Teammate Card */}
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <User className="size-3" />
                Host (Team Member)
              </div>
              <div className="flex items-center gap-2.5">
                <div
                  className="size-7 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm"
                  style={{
                    backgroundColor: selectedMeeting.assigned_to_email
                      ? colorForAssignee(selectedMeeting.assigned_to_email)
                      : "#f97316",
                  }}
                >
                  {(
                    teamMembers.find((m) => m.email === selectedMeeting.assigned_to_email)?.name ||
                    selectedMeeting.assigned_to_name ||
                    selectedMeeting.assigned_to_email ||
                    "H"
                  )[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {teamMembers.find((m) => m.email === selectedMeeting.assigned_to_email)?.name ||
                      selectedMeeting.assigned_to_name ||
                      selectedMeeting.assigned_to_email ||
                      "Unassigned Host"}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">
                    {selectedMeeting.assigned_to_email || "Not specified"}
                  </p>
                </div>
              </div>
            </div>

            {/* Attendee / Guest Card */}
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <Mail className="size-3" />
                Attendee (Guest)
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {selectedMeeting.attendee_name || "Guest Client"}
                </p>
                <a
                  href={`mailto:${selectedMeeting.attendee_email}`}
                  className="text-[10px] text-blue-500 hover:underline block truncate font-mono"
                >
                  {selectedMeeting.attendee_email || "No email"}
                </a>
                {selectedMeeting.attendee_phone && (
                  <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                    <Phone className="size-2.5" />
                    <span>{selectedMeeting.attendee_phone}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Video Call & Room Card */}
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                <Video className="size-3" />
                Provider Link
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {getProviderLabel(selectedMeeting.provider)}
                </p>
                {selectedMeeting.meeting_link ? (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <a
                      href={selectedMeeting.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-md text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-opacity"
                    >
                      <Video className="size-3" />
                      Join
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(selectedMeeting.meeting_link!)}
                      className="px-2.5 py-1 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 text-neutral-700 dark:text-neutral-300 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-400 mt-1">No video URL linked.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Responsive Action Buttons */}
          {selectedMeeting.status !== "cancelled" && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => handleUpdateMeetingStatus(selectedMeeting.id, "completed")}
                className="text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Check className="size-3.5 text-emerald-500" />
                Done
              </button>
              <button
                onClick={() => handleUpdateMeetingStatus(selectedMeeting.id, "cancelled")}
                className="text-[11px] font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-650 dark:text-red-400 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <X className="size-3.5" />
                Cancel
              </button>
              <button
                onClick={() =>
                  setReschedulingMeetingId(
                    reschedulingMeetingId === selectedMeeting.id ? null : selectedMeeting.id
                  )
                }
                className="text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="size-3.5" />
                {reschedulingMeetingId === selectedMeeting.id ? "Close Reschedule" : "Reschedule"}
              </button>
            </div>
          )}

          {/* Inline Reschedule Dialog */}
          {reschedulingMeetingId === selectedMeeting.id && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-xl p-3">
              <DateTimePicker value={rescheduleDateTime} onChange={setRescheduleDateTime} size="sm" />
              <button
                onClick={() => handleRescheduleMeeting(selectedMeeting)}
                disabled={!rescheduleDateTime || reschedulingBusy}
                className="text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center gap-1.5 justify-center"
              >
                {reschedulingBusy && <Loader2 className="size-3 animate-spin" />}
                Confirm New Slot
              </button>
            </div>
          )}
        </div>
      )}

      {/* Combined Meetings List Tables */}
      <div className="space-y-6 pt-2">
        {/* Upcoming Appointments Table */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-300 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Upcoming Appointments (
            {
              filteredMeetings.filter(
                (m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled"
              ).length
            }
            )
          </h5>
          <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
              <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                <tr>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Assistant</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Host (Assignee)</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Meeting</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                {filteredMeetings
                  .filter((m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled")
                  .map((m) => {
                    const hostName =
                      teamMembers.find((t) => t.email === m.assigned_to_email)?.name ||
                      m.assigned_to_name ||
                      m.assigned_to_email ||
                      "—";
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 cursor-pointer"
                        onClick={() => openMeetingPanel(m.id)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-neutral-900 dark:text-white">
                            {m.attendee_name || "Guest Client"}
                          </div>
                          <div className="text-[10px] text-neutral-450 font-mono mt-0.5">{m.attendee_email}</div>
                          {m.attendee_phone && (
                            <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                              <Phone className="size-2.5" />
                              {m.attendee_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
                            <Bot className="size-2.5" />
                            {m.bot_name || "General"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: m.assigned_to_email
                                  ? colorForAssignee(m.assigned_to_email)
                                  : "#9ca3af",
                              }}
                            />
                            <span className="text-xs truncate max-w-[120px]">{hostName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold truncate max-w-[160px]">{m.title}</div>
                          {m.meeting_link && (
                            <a
                              href={m.meeting_link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-500 hover:underline flex items-center gap-1 mt-1 text-[10px] cursor-pointer"
                            >
                              <Video className="size-2.5" /> Join {getProviderLabel(m.provider)}
                            </a>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
                          {formatDateTime(m.start_time)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                            {m.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(m.id, "completed")}
                              className="text-[10px] font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Done
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMeetingStatus(m.id, "cancelled")}
                              className="text-[10px] font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-2 py-1 rounded-md cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {filteredMeetings.filter(
                  (m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled"
                ).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
                      No upcoming appointments scheduled
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Past & Cancelled Appointments Table */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-450 flex items-center gap-2">
            <span className="size-2 rounded-full bg-neutral-400"></span>
            Past &amp; Cancelled Appointments (
            {
              filteredMeetings.filter(
                (m) => new Date(m.start_time) < new Date() || m.status === "cancelled"
              ).length
            }
            )
          </h5>
          <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <table className="w-full border-collapse text-left text-xs text-neutral-500 dark:text-neutral-400">
              <thead className="bg-neutral-50 dark:bg-neutral-955 font-semibold text-neutral-700 dark:text-neutral-300">
                <tr>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Assistant</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Host (Assignee)</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Meeting</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                  <th className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-350">
                {filteredMeetings
                  .filter((m) => new Date(m.start_time) < new Date() || m.status === "cancelled")
                  .map((m) => {
                    const hostName =
                      teamMembers.find((t) => t.email === m.assigned_to_email)?.name ||
                      m.assigned_to_name ||
                      m.assigned_to_email ||
                      "—";
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 opacity-75 cursor-pointer"
                        onClick={() => openMeetingPanel(m.id)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-neutral-800 dark:text-neutral-300">
                            {m.attendee_name || "Guest Client"}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{m.attendee_email}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                            <Bot className="size-2.5" />
                            {m.bot_name || "General"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs truncate max-w-[120px] block">{hostName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold truncate max-w-[160px]">{m.title}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono whitespace-nowrap">
                          {formatDateTime(m.start_time)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              m.status === "completed"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                                : "bg-red-50 text-red-755 dark:bg-red-950/20 dark:text-red-400"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                {filteredMeetings.filter(
                  (m) => new Date(m.start_time) < new Date() || m.status === "cancelled"
                ).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
                      No past meetings recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
