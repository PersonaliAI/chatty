"use client";

import { useState, useEffect, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import momentTimezonePlugin from "@fullcalendar/moment-timezone";
import type { EventClickArg, EventContentArg, EventInput } from "@fullcalendar/core";
import { colorForMeetingStatus } from "@/lib/meeting-colors";
import { getTimezones, tzOffsetLabel, detectTimezone } from "@/lib/locale-data";
import { Globe } from "lucide-react";

export interface MeetingsCalendarMeeting {
  id: string;
  title?: string;
  start_time: string;
  end_time?: string;
  status: string;
  assigned_to_email?: string;
}

/** Calendar-grid view of booked meetings, color-coded by meeting status
 * (Upcoming, Completed, Rescheduled, Cancelled). Supports dynamic timezone
 * switching and FullCalendar moment-timezone plugin. Loaded via next/dynamic
 * with ssr:false from page.tsx since FullCalendar needs the DOM. */
export function MeetingsCalendar({
  meetings,
  onSelectMeeting,
  defaultTimezone,
}: {
  meetings: MeetingsCalendarMeeting[];
  onSelectMeeting: (meetingId: string) => void;
  defaultTimezone?: string;
}) {
  const [selectedTz, setSelectedTz] = useState<string>(defaultTimezone || "UTC");

  useEffect(() => {
    if (defaultTimezone) {
      setSelectedTz(defaultTimezone);
    }
  }, [defaultTimezone]);

  const localBrowserTz = useMemo(() => {
    try {
      return detectTimezone();
    } catch {
      return "UTC";
    }
  }, []);

  const allTimezones = useMemo(() => getTimezones(), []);

  const events: EventInput[] = useMemo(() => {
    return meetings.map((m) => {
      const statusStyle = colorForMeetingStatus(m.status, m.start_time, m.end_time);
      return {
        id: m.id,
        title: m.title || "Meeting",
        start: m.start_time,
        end: m.end_time,
        backgroundColor: statusStyle.bg,
        borderColor: statusStyle.border,
        textColor: statusStyle.text,
        classNames: m.status === "cancelled" ? ["chatty-fc-cancelled"] : [],
        extendedProps: {
          status: m.status,
          statusLabel: statusStyle.label,
          assigned_to_email: m.assigned_to_email,
        },
      };
    });
  }, [meetings]);

  return (
    <div className="space-y-3">
      {/* Calendar Control Header: Status Legend & Timezone Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-3 py-2 bg-neutral-50 dark:bg-neutral-850/50 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs">
        {/* Status Legend */}
        <div className="flex items-center flex-wrap gap-3 text-[11px] text-neutral-600 dark:text-neutral-300">
          <span className="font-semibold text-[10px] uppercase tracking-wider text-neutral-400">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-slate-500 shadow-sm" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-amber-500 shadow-sm" />
            <span>Rescheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full bg-rose-500 shadow-sm" />
            <span>Cancelled</span>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="flex items-center gap-2">
          <Globe className="size-3.5 text-neutral-400 shrink-0" />
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0">Calendar Timezone:</span>
          <select
            value={selectedTz}
            onChange={(e) => setSelectedTz(e.target.value)}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs py-1 px-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer max-w-[240px] truncate"
          >
            {defaultTimezone && (
              <option value={defaultTimezone}>
                Bot Timezone: {defaultTimezone} ({tzOffsetLabel(defaultTimezone)})
              </option>
            )}
            {localBrowserTz && localBrowserTz !== defaultTimezone && (
              <option value={localBrowserTz}>
                Local Browser: {localBrowserTz} ({tzOffsetLabel(localBrowserTz)})
              </option>
            )}
            <option disabled>------------------------</option>
            {allTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz} ({tzOffsetLabel(tz)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main FullCalendar Component */}
      <div className="chatty-fc-theme bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-4">
        <style jsx global>{`
          .chatty-fc-cancelled { opacity: 0.6; text-decoration: line-through; }
          .chatty-fc-theme {
            --fc-border-color: rgba(115,115,115,0.18);
            --fc-page-bg-color: transparent;
            --fc-neutral-bg-color: rgba(115,115,115,0.06);
            --fc-today-bg-color: rgba(249,115,22,0.1);
            --fc-button-bg-color: transparent;
            --fc-button-border-color: rgba(115,115,115,0.3);
            --fc-button-hover-bg-color: rgba(115,115,115,0.12);
            --fc-button-hover-border-color: rgba(115,115,115,0.4);
            --fc-button-active-bg-color: #f97316;
            --fc-button-active-border-color: #f97316;
            --fc-button-text-color: #262626;
            color: #262626;
          }
          :global(.dark) .chatty-fc-theme {
            --fc-button-text-color: #e5e5e5;
            --fc-button-hover-bg-color: rgba(255,255,255,0.08);
            color: #e5e5e5;
          }
          .chatty-fc-theme .fc { font-size: 12px; }
          .chatty-fc-theme .fc-toolbar-title { font-size: 13px; font-weight: 700; }
          .chatty-fc-theme .fc-button {
            text-transform: capitalize; box-shadow: none !important; font-weight: 600;
            font-size: 11px !important; padding: 4px 10px !important;
            color: var(--fc-button-text-color) !important;
          }
          .chatty-fc-theme .fc-button-active {
            color: #ffffff !important;
          }
          .chatty-fc-theme .fc-button:disabled {
            opacity: 0.4;
          }
          .chatty-fc-theme .fc-icon { color: var(--fc-button-text-color); }
          .chatty-fc-theme .fc-event {
            cursor: pointer;
            border-radius: 6px;
            padding: 1px 3px;
            font-size: 11px;
            border-width: 1px;
            overflow: hidden;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          }
          .chatty-fc-theme .fc-daygrid-event {
            white-space: normal;
            margin-top: 2px;
            margin-bottom: 2px;
          }
          .chatty-fc-theme .fc-daygrid-day { cursor: pointer; transition: background-color 0.15s ease; }
          .chatty-fc-theme .fc-daygrid-day:hover { background-color: rgba(249, 115, 22, 0.05); }
          .chatty-fc-theme .fc-daygrid-day-number,
          .chatty-fc-theme .fc-col-header-cell-cushion {
            color: var(--fc-button-text-color); opacity: 0.75; font-size: 11px; cursor: pointer;
          }
        `}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, momentTimezonePlugin]}
          timeZone={selectedTz}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          navLinks={true}
          navLinkDayClick="timeGridDay"
          dateClick={(info: DateClickArg) => {
            const api = info.view.calendar;
            api.gotoDate(info.date);
            api.changeView("timeGridDay");
          }}
          events={events}
          eventDisplay="block"
          height="auto"
          eventClick={(info: EventClickArg) => onSelectMeeting(info.event.id)}
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          eventContent={(eventInfo: EventContentArg) => {
            const isCancelled = eventInfo.event.extendedProps.status === "cancelled";
            const statusLabel = eventInfo.event.extendedProps.statusLabel || "";
            const timeStr = eventInfo.timeText;
            const title = eventInfo.event.title;
            const assignedEmail = eventInfo.event.extendedProps.assigned_to_email;

            return (
              <div
                className="w-full flex items-center gap-1.5 px-1 py-0.5 overflow-hidden text-ellipsis whitespace-nowrap"
                title={`${title}${timeStr ? ` (${timeStr})` : ""} - ${statusLabel}${assignedEmail ? ` [Assigned: ${assignedEmail}]` : ""}`}
              >
                {timeStr && (
                  <span className="font-semibold text-[10px] tracking-tight shrink-0 text-white/90">
                    {timeStr}
                  </span>
                )}
                <span className={`text-[10.5px] truncate ${isCancelled ? "line-through opacity-80" : "font-medium text-white"}`}>
                  {title}
                </span>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
