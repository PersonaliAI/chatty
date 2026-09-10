// Deterministic email -> color mapping for the Meetings calendar (assignee
// color-coding) and its details panel. Split out from meetings-calendar.tsx
// so page.tsx can import just this (no DOM/FullCalendar dependency) without
// pulling FullCalendar into the main bundle - that component is lazy-loaded
// with next/dynamic(ssr:false) specifically to avoid that.

// A fixed palette (not derived from the bot's own theme colors) so a given
// team member's color stays visually distinct from the brand's primary
// color and stable across bots - matching a person to a color is more
// useful here than matching the dashboard's own accent.
const PALETTE = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#ec4899", "#06b6d4", "#eab308", "#ef4444"];

export function colorForAssignee(email?: string): string {
  if (!email) return "#737373";
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export interface MeetingStatusColor {
  bg: string;
  text: string;
  label: string;
  border: string;
  dotColor: string;
}

export function colorForMeetingStatus(status?: string, startTime?: string, endTime?: string): MeetingStatusColor {
  const s = (status || "scheduled").toLowerCase();
  if (s === "cancelled") {
    return {
      bg: "#ef4444",
      text: "#ffffff",
      label: "Cancelled",
      border: "#dc2626",
      dotColor: "#ef4444",
    };
  }
  if (s === "rescheduled") {
    return {
      bg: "#f59e0b",
      text: "#ffffff",
      label: "Rescheduled",
      border: "#d97706",
      dotColor: "#f59e0b",
    };
  }
  if (s === "completed") {
    return {
      bg: "#64748b",
      text: "#ffffff",
      label: "Completed",
      border: "#475569",
      dotColor: "#64748b",
    };
  }

  // Check if past proceed meeting
  const checkTime = endTime || startTime;
  if (checkTime) {
    const end = new Date(checkTime);
    if (!isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return {
        bg: "#64748b",
        text: "#ffffff",
        label: "Completed",
        border: "#475569",
        dotColor: "#64748b",
      };
    }
  }

  // Upcoming / Scheduled
  return {
    bg: "#10b981",
    text: "#ffffff",
    label: "Upcoming",
    border: "#059669",
    dotColor: "#10b981",
  };
}
