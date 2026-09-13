"use client";

import dynamic from "next/dynamic";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { ModernSelect } from "@/components/ui/modern-select";
import { colorForAssignee } from "@/lib/meeting-colors";
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
  [key: string]: unknown;
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
  const isAgentView = myRole === "agent";
  const assignees = Array.from(
    new Set(adminMeetings.map((m) => m.assigned_to_email).filter(Boolean))
  ) as string[];
  const filteredMeetings =
    !isAgentView && meetingMemberFilter !== "all"
      ? adminMeetings.filter((m) => m.assigned_to_email === meetingMemberFilter)
      : adminMeetings;
  const selectedMeeting = adminMeetings.find((m) => m.id === selectedMeetingId) || null;

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Scheduled Meetings</h4>
          <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
            Calendar events booked by visitors through the assistant widget.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAgentView && assignees.length > 1 && (
            <div className="w-44">
              <ModernSelect
                value={meetingMemberFilter}
                options={[
                  { value: "all", label: "All team members" },
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
            onClick={() => loadAdminData(botId || "")}
            className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>
      </div>

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
          }))}
          onSelectMeeting={openMeetingPanel}
          defaultTimezone={botTimezone || "UTC"}
        />
      )}

      {selectedMeeting && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h5 className="text-sm font-bold text-neutral-900 dark:text-white">
                {selectedMeeting.title || "Meeting"}
              </h5>
              <p className="text-[11px] text-neutral-500 mt-0.5">{formatDateTime(selectedMeeting.start_time)}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                {selectedMeeting.attendee_name || "Guest"} ·{" "}
                <span className="font-mono">{selectedMeeting.attendee_email}</span>
              </p>
              {selectedMeeting.assigned_to_email && (
                <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: colorForAssignee(selectedMeeting.assigned_to_email) }}
                  />
                  Assigned to{" "}
                  {teamMembers.find((m) => m.email === selectedMeeting.assigned_to_email)?.name ||
                    selectedMeeting.assigned_to_email}
                </p>
              )}
              <span className="inline-flex items-center mt-2 gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {selectedMeeting.status}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedMeetingId(null);
                setReschedulingMeetingId(null);
              }}
              className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              Close
            </button>
          </div>

          {selectedMeeting.meeting_link && (
            <a
              href={selectedMeeting.meeting_link}
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 hover:underline flex items-center gap-1 text-[11px] w-fit"
            >
              <ExternalLink className="size-3" /> Join{" "}
              {selectedMeeting.provider === "google_meet" ? "Google Meet" : selectedMeeting.provider}
            </a>
          )}

          {selectedMeeting.status !== "cancelled" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleUpdateMeetingStatus(selectedMeeting.id, "completed")}
                className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                Mark done
              </button>
              <button
                onClick={() => handleUpdateMeetingStatus(selectedMeeting.id, "cancelled")}
                className="text-[10px] font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  setReschedulingMeetingId(
                    reschedulingMeetingId === selectedMeeting.id ? null : selectedMeeting.id
                  )
                }
                className="text-[10px] font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                {reschedulingMeetingId === selectedMeeting.id ? "Cancel reschedule" : "Reschedule"}
              </button>
            </div>
          )}

          {reschedulingMeetingId === selectedMeeting.id && (
            <div className="flex flex-wrap items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3">
              <input
                type="datetime-local"
                value={rescheduleDateTime}
                onChange={(e) => setRescheduleDateTime(e.target.value)}
                className="text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5"
              />
              <button
                onClick={() => handleRescheduleMeeting(selectedMeeting)}
                disabled={!rescheduleDateTime || reschedulingBusy}
                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {reschedulingBusy ? "Saving…" : "Confirm new time"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Original list view - kept alongside the calendar above, not replaced by it. */}
      <div className="space-y-8 pt-4">
        <div className="space-y-4">
          <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-300 flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Upcoming appointments (
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
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Meeting Details</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 font-medium text-neutral-800 dark:text-neutral-200">
                {filteredMeetings
                  .filter((m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled")
                  .map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 cursor-pointer"
                      onClick={() => openMeetingPanel(m.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {m.attendee_name || "Guest User"}
                        </div>
                        <div className="text-[10px] text-neutral-450 font-mono mt-0.5">{m.attendee_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{m.title}</div>
                        {m.meeting_link && (
                          <a
                            href={m.meeting_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-500 hover:underline flex items-center gap-1 mt-1 text-[10px] cursor-pointer"
                          >
                            <ExternalLink className="size-3" /> Join{" "}
                            {m.provider === "google_meet" ? "Google Meet" : m.provider}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-neutral-600 dark:text-neutral-300">
                        {formatDateTime(m.start_time)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleUpdateMeetingStatus(m.id, "completed")}
                            className="text-[9px] font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Done
                          </button>
                          <button
                            onClick={() => handleUpdateMeetingStatus(m.id, "cancelled")}
                            className="text-[9px] font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-650 dark:text-red-400 px-2 py-1 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {filteredMeetings.filter(
                  (m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled"
                ).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
                      No upcoming appointments scheduled
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <h5 className="text-xs font-bold text-neutral-750 dark:text-neutral-450 flex items-center gap-2">
            <span className="size-2 rounded-full bg-neutral-400"></span>
            Past / Cancelled appointments (
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
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Client</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Meeting Details</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Scheduled Time</th>
                  <th className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-350">
                {filteredMeetings
                  .filter((m) => new Date(m.start_time) < new Date() || m.status === "cancelled")
                  .map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/10 opacity-75 cursor-pointer"
                      onClick={() => openMeetingPanel(m.id)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-neutral-800 dark:text-neutral-300">
                          {m.attendee_name || "Guest User"}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{m.attendee_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{m.title}</div>
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {formatDateTime(m.start_time)}
                      </td>
                      <td className="px-6 py-4">
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
                  ))}

                {filteredMeetings.filter(
                  (m) => new Date(m.start_time) < new Date() || m.status === "cancelled"
                ).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-400 dark:text-neutral-500">
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
