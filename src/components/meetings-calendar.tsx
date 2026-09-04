"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { colorForAssignee } from "@/lib/meeting-colors";

export interface MeetingsCalendarMeeting {
  id: string;
  title?: string;
  start_time: string;
  end_time?: string;
  status: string;
  assigned_to_email?: string;
}

/** Calendar-grid view of booked meetings, color-coded by whichever team
 * member the round-robin engine assigned each one to (plugins/agent_tools.py
 * -> chatty_meetings.assigned_to_email) — replaces the old plain-table
 * Meetings tab. Loaded via next/dynamic with ssr:false from page.tsx since
 * FullCalendar needs the DOM. */
export function MeetingsCalendar({
  meetings,
  onSelectMeeting,
}: {
  meetings: MeetingsCalendarMeeting[];
  onSelectMeeting: (meetingId: string) => void;
}) {
  const events: EventInput[] = meetings.map((m) => ({
    id: m.id,
    title: m.title || "Meeting",
    start: m.start_time,
    end: m.end_time,
    backgroundColor: m.status === "cancelled" ? "#a3a3a3" : colorForAssignee(m.assigned_to_email),
    borderColor: "transparent",
    textColor: "#ffffff",
    classNames: m.status === "cancelled" ? ["chatty-fc-cancelled"] : [],
  }));

  return (
    <div className="chatty-fc-theme bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-4">
      <style jsx global>{`
        .chatty-fc-cancelled { opacity: 0.55; text-decoration: line-through; }
        .chatty-fc-theme { --fc-border-color: rgba(115,115,115,0.18); --fc-page-bg-color: transparent; --fc-neutral-bg-color: rgba(115,115,115,0.06); --fc-today-bg-color: rgba(249,115,22,0.08); --fc-button-bg-color: transparent; --fc-button-border-color: rgba(115,115,115,0.25); --fc-button-hover-bg-color: rgba(115,115,115,0.1); --fc-button-active-bg-color: rgba(249,115,22,0.15); --fc-button-text-color: inherit; }
        .chatty-fc-theme .fc { font-family: inherit; font-size: 12px; color: inherit; }
        .chatty-fc-theme .fc-toolbar-title { font-size: 13px; font-weight: 700; }
        .chatty-fc-theme .fc-button { text-transform: capitalize; box-shadow: none !important; font-weight: 600; font-size: 11px !important; padding: 4px 10px !important; }
        .chatty-fc-theme .fc-event { cursor: pointer; border-radius: 6px; padding: 1px 4px; font-size: 10px; }
        .chatty-fc-theme .fc-daygrid-day-number, .chatty-fc-theme .fc-col-header-cell-cushion { color: inherit; opacity: 0.75; font-size: 11px; }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        events={events}
        height="auto"
        eventClick={(info: EventClickArg) => onSelectMeeting(info.event.id)}
        eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
      />
    </div>
  );
}
