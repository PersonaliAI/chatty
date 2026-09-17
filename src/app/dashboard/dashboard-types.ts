// Shared TypeScript types for Chatty Dashboard components and tabs

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  company?: string;
  job_title?: string;
  country?: string;
  industry?: string;
  budget?: string;
  custom_fields?: Record<string, unknown>;
  session_id?: string;
  [key: string]: unknown;
}

// Fields the dashboard actually reads/writes off a chatty_bots row (see
// switchActiveBot below, which is the exhaustive source for this list) -
// the index signature covers everything else the table has that this file
// doesn't touch by name.
export interface Bot {
  id: string;
  name: string;
  welcome_message?: string;
  conversation_starters?: string[];
  teaser_message?: string;
  primary_color?: string;
  widget_style?: string;
  font_family?: string | null;
  font_size_percent?: number;
  panel_size?: string;
  send_button_style?: string;
  avatar_icon?: string;
  avatar_url?: string | null;
  logo_url?: string | null;
  selected_model?: string;
  system_instructions?: string;
  strict_mode?: boolean;
  answer_mode?: "strict" | "hybrid" | "web";
  email_notify?: boolean;
  hide_branding?: boolean;
  show_sender_tag?: boolean;
  csat_enabled?: boolean;
  voice_message_mode?: "transcribe" | "audio";
  webhook_url?: string;
  custom_css?: string;
  custom_js?: string;
  response_language?: string;
  guardrail_topics?: string;
  guardrail_block_profanity?: boolean;
  guardrail_refusal_message?: string;
  sync_google_drive?: boolean;
  sync_google_calendar?: boolean;
  calendar_scheduling_enabled?: boolean;
  scheduling_duration_minutes?: number;
  bot_timezone?: string;
  business_hours_start?: number;
  business_hours_end?: number;
  working_days?: string[];
  buffer_minutes?: number;
  advance_notice_hours?: number;
  max_daily_meetings?: number;
  max_weekly_meetings?: number;
  allowed_domains?: string[];
  onboarding_step?: number;
  onboarding_completed?: boolean;
  lead_fields?: string[];
  lead_capture_enabled?: boolean;
  lead_required_fields?: string[];
  bot_country?: string;
  sync_outlook_calendar?: boolean;
  sync_office365_calendar?: boolean;
  meeting_provider?: string;
  booking_email_verification?: boolean;
  booking_block_disposable_emails?: boolean;
  booking_limit_one_active?: boolean;
  booking_require_business_email?: boolean;
  google_connected_account_id?: string | null;
  google_calendar_id?: string | null;
  google_calendar_name?: string | null;
  google_calendar_color?: string | null;
  google_drive_folder_id?: string | null;
  google_drive_folder_name?: string | null;
  [key: string]: unknown;
}

export interface AdminMeeting {
  id: string;
  title?: string;
  attendee_name?: string;
  attendee_email?: string;
  start_time: string;
  end_time?: string;
  status: string;
  provider?: string;
  meeting_link?: string;
  assigned_to_email?: string;
  description?: string;
}

export interface MeetingMessage {
  id: string;
  direction: "inbound" | "outbound";
  from_email: string;
  subject?: string;
  body_text?: string;
  created_at: string;
}

export interface AdminNotification {
  id: string;
  type?: string;
  channel?: string;
  recipient?: string;
  subject?: string;
  content?: string;
  html_content?: string;
  status?: string;
  error_message?: string;
  created_at?: string;
}

export interface AdminAuditLog {
  id: string;
  action?: string;
  details?: string;
  performed_by?: string;
  created_at?: string;
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  revoked?: boolean;
  request_count?: number;
  last_used_at?: string | null;
  created_at?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events?: string[];
  created_at?: string;
}

export interface Source {
  id: string;
  type: "text" | "url" | "file";
  name: string;
  content: string;
  status: "training" | "trained";
  charCount: number;
  crawlSchedule?: "off" | "daily" | "weekly" | "monthly";
  nextCrawlAt?: string | null;
}

export type SourceRecord = {
  id: string;
  type: Source["type"];
  name: string;
  content?: string;
  status: Source["status"];
  char_count?: number;
  charCount?: number;
  crawl_schedule?: Source["crawlSchedule"];
  next_crawl_at?: string | null;
};

export type ErrorDetails = {
  message?: string;
  error_description?: string;
  detail?: string;
  hint?: string;
};

export function errorMessageFromUnknown(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const details = err as ErrorDetails;
    return details.message || details.error_description || details.detail || details.hint || JSON.stringify(err);
  }
  return "An unexpected error occurred.";
}

export interface QuickReply {
  label: string;
  value: string;
  icon?: string;
}

export interface KnowledgeMessage {
  role: string;
  content: string;
  status?: "info" | "success" | "error" | "pending";
  filename?: string;
  quickReplies?: QuickReply[];
  connectorButtons?: boolean;
  calendarButtons?: boolean;
  leadFieldPicker?: boolean;
  tzPicker?: boolean;
  providerPicker?: boolean;
  isSetup?: boolean;
  thinkingSteps?: string[];
}

export interface CsatFeedbackItem {
  id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  session_id?: string | null;
}

export interface TeamMember {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  permissions?: string[];
  bookable?: boolean;
  book_on_own_calendar?: boolean;
}

