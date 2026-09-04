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
        /* Explicit concrete colors throughout (no "inherit") — FullCalendar's
           own buttons/icons/labels don't reliably pick up ambient page text
           color through the custom-property indirection, which previously
           left toolbar buttons and view-switcher labels rendering
           text-on-matching-background (invisible, not actually missing). */
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
        /* Disabled (e.g. "today" when the calendar already shows the
           current range) keeps the normal text color — only its own
           background changes (dims via opacity), unlike the active-view
           button which gets a real orange fill. Matching disabled's color
           to active's white text left it invisible against its own
           unchanged transparent background — this is that fix. */
        .chatty-fc-theme .fc-button:disabled {
          opacity: 0.4;
        }
        .chatty-fc-theme .fc-icon { color: var(--fc-button-text-color); }
        .chatty-fc-theme .fc-event { cursor: pointer; border-radius: 6px; padding: 1px 4px; font-size: 10px; }
        .chatty-fc-theme .fc-daygrid-day-number,
        .chatty-fc-theme .fc-col-header-cell-cushion {
          color: var(--fc-button-text-color); opacity: 0.75; font-size: 11px;
        }
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
