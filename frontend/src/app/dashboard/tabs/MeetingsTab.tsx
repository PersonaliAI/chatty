"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  CalendarCheck,
  Link2,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  Timer,
  ToggleLeft,
  ToggleRight,
  Info,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ModernSelect } from "@/components/ui/modern-select";
import { colorForAssignee, colorForMeetingStatus } from "@/lib/meeting-colors";
import type { AdminMeeting, TeamMember } from "../dashboard-types";

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
  google_connected?: boolean;
  google_email?: string | null;
  microsoft_connected?: boolean;
  microsoft_email?: string | null;
  [key: string]: any;
}

export interface EventTypeItem {
  id: string;
  bot_id: string;
  title: string;
  slug: string;
  description?: string | null;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_hours: number;
  max_bookings_per_day?: number | null;
  price_cents: number;
  currency: string;
  intent_triggers: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface MeetingsTabProps {
  myRole: string | null;
  adminMeetings: AdminMeeting[];
  meetingMemberFilter: string;
  setMeetingMemberFilter: (v: string) => void;
  selectedMeetingId: string | null;
  setSelectedMeetingId: (id: string | null) => void;
  teamMembers: TeamMemberLike[] | TeamMember[];
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
  user?: { id?: string; email?: string | null; name?: string | null; [key: string]: any } | null;
  fetchWithFallback?: (url: string, init?: RequestInit) => Promise<Response>;
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
  reloadTeam?: () => Promise<void> | void;
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
  user,
  fetchWithFallback,
  showToast,
  reloadTeam,
}: MeetingsTabProps) {
  // Cal.com Top Navigation Sub-tab: "event_types" | "appointments"
  const [activeSubTab, setActiveSubTab] = useState<"event_types" | "appointments">("event_types");

  // Multi-bot & Assignee filters
  const [botFilter, setBotFilter] = useState<string>("all");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTagSlug, setCopiedTagSlug] = useState<string | null>(null);
  const isAgentView = myRole === "agent";

  // Event Types State
  const [eventTypes, setEventTypes] = useState<EventTypeItem[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventTypeItem | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  // Form inputs for New/Edit Event Type
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formBufferBefore, setFormBufferBefore] = useState(0);
  const [formBufferAfter, setFormBufferAfter] = useState(10);
  const [formMinNoticeHours, setFormMinNoticeHours] = useState(2);
  const [formMaxBookingsPerDay, setFormMaxBookingsPerDay] = useState<string>("");
  const [formPriceDollars, setFormPriceDollars] = useState("0");
  const [formCurrency, setFormCurrency] = useState("usd");
  const [formIntentTriggers, setFormIntentTriggers] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const activeBotId = botFilter !== "all" ? botFilter : (botId || (allBots[0]?.id ?? null));

  // Load Event Types for currently selected bot
  const loadEventTypes = useCallback(async (targetBotId?: string | null) => {
    const bId = targetBotId !== undefined ? targetBotId : activeBotId;
    if (!bId || bId === "all") {
      setEventTypes([]);
      return;
    }
    setLoadingEventTypes(true);
    try {
      const res = await (fetchWithFallback || fetch)(`/api/bots/${bId}/event-types?active_only=false`);
      if (res.ok) {
        const data = await res.json();
        setEventTypes(data.event_types || []);
      }
    } catch (err) {
      console.error("Failed to load event types:", err);
    } finally {
      setLoadingEventTypes(false);
    }
  }, [activeBotId, fetchWithFallback]);

  useEffect(() => {
    if (activeBotId && activeBotId !== "all") {
      void loadEventTypes(activeBotId);
    }
  }, [activeBotId, loadEventTypes]);

  const handleOpenCreateModal = () => {
    setEditingEventType(null);
    setFormTitle("");
    setFormSlug("");
    setFormDescription("");
    setFormDuration(30);
    setFormBufferBefore(0);
    setFormBufferAfter(10);
    setFormMinNoticeHours(2);
    setFormMaxBookingsPerDay("");
    setFormPriceDollars("0");
    setFormCurrency("usd");
    setFormIntentTriggers("demo, consultation, meeting");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (et: EventTypeItem) => {
    setEditingEventType(et);
    setFormTitle(et.title);
    setFormSlug(et.slug);
    setFormDescription(et.description || "");
    setFormDuration(et.duration_minutes || 30);
    setFormBufferBefore(et.buffer_before_minutes || 0);
    setFormBufferAfter(et.buffer_after_minutes || 0);
    setFormMinNoticeHours(et.min_notice_hours || 0);
    setFormMaxBookingsPerDay(et.max_bookings_per_day ? String(et.max_bookings_per_day) : "");
    setFormPriceDollars(et.price_cents ? (et.price_cents / 100).toFixed(2) : "0");
    setFormCurrency(et.currency || "usd");
    setFormIntentTriggers((et.intent_triggers || []).join(", "));
    setFormIsActive(et.is_active);
    setIsModalOpen(true);
  };

  const handleSaveEventType = async (e: React.FormEvent) => {
    e.preventDefault();
    const bId = editingEventType?.bot_id || activeBotId;
    if (!bId || bId === "all") {
      showToast?.("Please select a specific Assistant to create an Event Type.", "error");
      return;
    }
    if (!formTitle.trim()) {
      showToast?.("Title is required", "error");
      return;
    }
    setModalBusy(true);
    try {
      const payload = {
        title: formTitle.trim(),
        slug: formSlug.trim() || formTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: formDescription.trim() || null,
        duration_minutes: Number(formDuration) || 30,
        buffer_before_minutes: Number(formBufferBefore) || 0,
        buffer_after_minutes: Number(formBufferAfter) || 0,
        min_notice_hours: Number(formMinNoticeHours) || 0,
        max_bookings_per_day: formMaxBookingsPerDay ? Number(formMaxBookingsPerDay) : null,
        price_cents: Math.round((Number(formPriceDollars) || 0) * 100),
        currency: formCurrency.toLowerCase().trim() || "usd",
        intent_triggers: formIntentTriggers
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        is_active: formIsActive,
      };

      if (editingEventType) {
        const res = await (fetchWithFallback || fetch)(`/api/bots/${bId}/event-types/${editingEventType.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast?.("Event type updated successfully", "success");
          setIsModalOpen(false);
          setEditingEventType(null);
          void loadEventTypes(bId);
        } else {
          const err = await res.json().catch(() => ({}));
          showToast?.(err.detail || "Failed to update event type", "error");
        }
      } else {
        const res = await (fetchWithFallback || fetch)(`/api/bots/${bId}/event-types`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToast?.("Event type created successfully", "success");
          setIsModalOpen(false);
          setEditingEventType(null);
          void loadEventTypes(bId);
        } else {
          const err = await res.json().catch(() => ({}));
          showToast?.(err.detail || "Failed to create event type", "error");
        }
      }
    } catch {
      showToast?.("Error saving event type", "error");
    } finally {
      setModalBusy(false);
    }
  };

  const handleToggleActive = async (et: EventTypeItem) => {
    const bId = et.bot_id || activeBotId;
    if (!bId) return;
    try {
      const res = await (fetchWithFallback || fetch)(`/api/bots/${bId}/event-types/${et.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !et.is_active }),
      });
      if (res.ok) {
        setEventTypes((prev) =>
          prev.map((item) => (item.id === et.id ? { ...item, is_active: !item.is_active } : item))
        );
        showToast?.(`"${et.title}" ${!et.is_active ? "activated" : "deactivated"}`, "success");
      } else {
        showToast?.("Failed to update status", "error");
      }
    } catch {
      showToast?.("Error updating event type", "error");
    }
  };

  const handleDeleteEventType = async (et: EventTypeItem) => {
    if (!confirm(`Are you sure you want to deactivate and remove "${et.title}"?`)) return;
    const bId = et.bot_id || activeBotId;
    if (!bId) return;
    try {
      const res = await (fetchWithFallback || fetch)(`/api/bots/${bId}/event-types/${et.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEventTypes((prev) => prev.filter((item) => item.id !== et.id));
        showToast?.(`Event type "${et.title}" removed`, "success");
      } else {
        showToast?.("Failed to delete event type", "error");
      }
    } catch {
      showToast?.("Error deleting event type", "error");
    }
  };

  const handleCopyAiTag = (slug: string) => {
    const tag = `[BOOKING_WIDGET:${slug}]`;
    navigator.clipboard.writeText(tag);
    setCopiedTagSlug(slug);
    showToast?.(`Copied AI widget tag ${tag} to clipboard`, "info");
    setTimeout(() => setCopiedTagSlug(null), 2000);
  };

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

  const currentUserEmail = (user?.email || "").toLowerCase().trim();
  const currentMember = (teamMembers as (TeamMemberLike | TeamMember)[]).find(
    (m) => (m.email || "").toLowerCase().trim() === currentUserEmail || (m.id && user?.id && m.id === user.id)
  );

  const handleConnectMyCalendar = async (provider: "google" | "microsoft") => {
    if (!fetchWithFallback) return;
    try {
      const memberId = currentMember?.id || user?.id || "owner";
      const res = await fetchWithFallback(`/api/integrations/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          scope_type: "calendar",
          member_id: memberId,
          redirect_path: "/dashboard?tab=meetings",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      showToast?.(`Could not start ${provider === "google" ? "Google" : "Outlook"} calendar authorization.`, "error");
    } catch {
      showToast?.(`Error connecting ${provider === "google" ? "Google" : "Outlook"} calendar.`, "error");
    }
  };

  const handleDisconnectMyCalendar = async (provider: "google" | "microsoft") => {
    if (!botId || !fetchWithFallback) return;
    try {
      const memberId = currentMember?.id || user?.id || "owner";
      const res = await fetchWithFallback(`/api/team/${memberId}/calendar-disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          provider,
        }),
      });
      if (res.ok) {
        showToast?.(`${provider === "google" ? "Google" : "Outlook"} calendar disconnected.`, "success");
        void reloadTeam?.();
      } else {
        showToast?.(`Failed to disconnect ${provider} calendar.`, "error");
      }
    } catch {
      showToast?.(`Error disconnecting ${provider} calendar.`, "error");
    }
  };

  const upcomingCount = filteredMeetings.filter(
    (m) => new Date(m.start_time) >= new Date() && m.status !== "cancelled"
  ).length;

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      {/* Top Header & Assistant Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-neutral-900 dark:text-white">Calendar &amp; Booking Management</h4>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-[#f97316] border border-orange-500/20">
              Cal.com Grade
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Enterprise scheduling engine with multi-calendar sync, fatigue limits, AI routing, and paid event types.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isAgentView && allBots && allBots.length > 1 && (
            <div className="w-48">
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
                  if (val !== "all") {
                    void loadEventTypes(val);
                  }
                }}
              />
            </div>
          )}
          <button
            onClick={() => {
              void loadAdminData(botFilter || botId || "all");
              if (activeBotId && activeBotId !== "all") void loadEventTypes(activeBotId);
            }}
            className="text-xs font-medium border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg px-3 py-1.5 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Cal.com Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("event_types")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "event_types"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Layers className="size-3.5" />
            <span>Event Types</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeSubTab === "event_types"
                  ? "bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-900"
                  : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {eventTypes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("appointments")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === "appointments"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <CalendarDays className="size-3.5" />
            <span>Bookings &amp; Calendar</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeSubTab === "appointments"
                  ? "bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-900"
                  : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              }`}
            >
              {upcomingCount}
            </span>
          </button>
        </div>

        {activeSubTab === "event_types" && !isAgentView && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 rounded-xl bg-[#f97316] hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>New Event Type</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: EVENT TYPES (CAL.COM EVENT TYPES MANAGER)                         */}
      {/* ========================================================================= */}
      {activeSubTab === "event_types" && (
        <div className="space-y-4">
          {loadingEventTypes ? (
            <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <Loader2 className="size-6 animate-spin text-[#f97316]" />
            </div>
          ) : eventTypes.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
              <div className="size-12 rounded-2xl bg-orange-500/10 text-[#f97316] flex items-center justify-center mx-auto border border-orange-500/20">
                <Layers className="size-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h5 className="text-sm font-bold text-neutral-900 dark:text-white">No Event Types Configured</h5>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Create bookable event types with custom durations, buffers, daily caps, and AI intent triggers.
                </p>
              </div>
              {!isAgentView && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 rounded-xl bg-[#f97316] hover:bg-orange-600 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                >
                  <Plus className="size-4" />
                  <span>Create Your First Event Type</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventTypes.map((et) => {
                const isPaid = (et.price_cents || 0) > 0;
                return (
                  <div
                    key={et.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      et.is_active
                        ? "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700"
                        : "bg-neutral-50/70 dark:bg-neutral-925/50 border-neutral-200/60 dark:border-neutral-800/60 opacity-70"
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Top Badges & Active Toggle */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              et.is_active
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700"
                            }`}
                          >
                            <span className={`size-1.5 rounded-full ${et.is_active ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
                            {et.is_active ? "Active" : "Disabled"}
                          </span>

                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <DollarSign className="size-2.5" />
                              ${(et.price_cents / 100).toFixed(2)} {et.currency.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                              Free
                            </span>
                          )}
                        </div>

                        {/* Card Top Action Menu */}
                        {!isAgentView && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(et)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                              title={et.is_active ? "Deactivate" : "Activate"}
                            >
                              {et.is_active ? (
                                <ToggleRight className="size-5 text-emerald-500" />
                              ) : (
                                <ToggleLeft className="size-5 text-neutral-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(et)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                              title="Edit Event Type"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEventType(et)}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                              title="Delete Event Type"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Title & Slug */}
                      <div>
                        <h5 className="text-sm font-bold text-neutral-900 dark:text-white">{et.title}</h5>
                        <p className="text-[11px] font-mono text-neutral-400 mt-0.5">/{et.slug}</p>
                      </div>

                      {et.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                          {et.description}
                        </p>
                      )}

                      {/* Cal.com Scheduling Rules Pills */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-medium">
                          <Clock className="size-3 text-neutral-400" />
                          {et.duration_minutes} mins
                        </span>

                        {(et.buffer_before_minutes > 0 || et.buffer_after_minutes > 0) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-medium">
                            <Sliders className="size-3 text-neutral-400" />
                            +{et.buffer_before_minutes}m / +{et.buffer_after_minutes}m buffer
                          </span>
                        )}

                        {et.min_notice_hours > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-medium">
                            <Timer className="size-3 text-neutral-400" />
                            {et.min_notice_hours}h notice
                          </span>
                        )}

                        {et.max_bookings_per_day && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 font-medium">
                            <ShieldCheck className="size-3 text-emerald-500" />
                            Max {et.max_bookings_per_day}/day
                          </span>
                        )}
                      </div>

                      {/* AI Intent Triggers */}
                      {et.intent_triggers && et.intent_triggers.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <Sparkles className="size-2.5 text-orange-400" />
                            AI triggers:
                          </span>
                          {et.intent_triggers.map((t, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleCopyAiTag(et.slug)}
                        className="text-[11px] font-mono text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Copy AI Prompt Embedding Tag"
                      >
                        {copiedTagSlug === et.slug ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        <span>[BOOKING_WIDGET:{et.slug}]</span>
                      </button>

                      <span className="text-[10px] text-neutral-400">
                        {et.updated_at ? `Updated ${new Date(et.updated_at).toLocaleDateString()}` : "Ready"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: BOOKINGS, FULLCALENDAR & APPOINTMENTS (ORIGINAL VIEW)             */}
      {/* ========================================================================= */}
      {activeSubTab === "appointments" && (
        <div className="space-y-4">
          {/* Host Filter Controls */}
          {!isAgentView && assignees.length > 1 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-400">Filter by Teammate Host:</span>
              <div className="w-48">
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
            </div>
          )}

          {/* Teammate Personal Calendar Sync Banner (Strictly Calendar-Only) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-neutral-50 via-white to-neutral-50 dark:from-neutral-900 dark:via-neutral-925 dark:to-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-orange-500/10 text-[#f97316] flex items-center justify-center shrink-0 border border-orange-500/20">
                <CalendarCheck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    My Calendar Sync (Personal Schedule)
                  </span>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    🔒 Strict Calendar-Only
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Connect your personal Google or Outlook calendar so meetings assigned to you sync directly to your schedule.
                </p>
              </div>
            </div>

            {/* Action Pills */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Google Calendar Pill */}
              {currentMember?.google_connected ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="size-3" /> Google: {currentMember.google_email || "Synced"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDisconnectMyCalendar("google")}
                    className="text-neutral-400 hover:text-red-600 text-xs font-bold ml-1 cursor-pointer"
                    title="Disconnect personal Google Calendar"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnectMyCalendar("google")}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Connect personal Google Calendar (strictly calendar scope)"
                >
                  <svg className="size-3" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span>+ Connect Google</span>
                </button>
              )}

              {/* Outlook Calendar Pill */}
              {currentMember?.microsoft_connected ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="size-3" /> Outlook: {currentMember.microsoft_email || "Synced"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDisconnectMyCalendar("microsoft")}
                    className="text-neutral-400 hover:text-red-600 text-xs font-bold ml-1 cursor-pointer"
                    title="Disconnect personal Outlook Calendar"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnectMyCalendar("microsoft")}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Connect personal Outlook Calendar (strictly calendar scope)"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                  <span>+ Connect Outlook</span>
                </button>
              )}
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
                          className="px-2.5 py-1 bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-755 text-neutral-700 dark:text-neutral-300 rounded-md text-[10px] font-medium flex items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
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
                Upcoming Appointments ({upcomingCount})
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
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE / EDIT EVENT TYPE (CAL.COM EVENT SETTINGS)                  */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur z-10">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-orange-500/10 text-[#f97316] flex items-center justify-center border border-orange-500/20">
                  <Sliders className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {editingEventType ? "Edit Event Type" : "Create New Event Type"}
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Cal.com-grade rules, buffer intervals, and pricing settings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingEventType(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveEventType} className="p-5 space-y-4 flex-1">
              {/* Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (!editingEventType && !formSlug) {
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                    placeholder="e.g. 30m Product Demo"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-neutral-400 font-mono">/</span>
                    <input
                      type="text"
                      required
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                      placeholder="demo"
                      className="w-full text-xs pl-6 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="A brief overview of what this meeting covers..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                />
              </div>

              {/* Timing & Buffers Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Clock className="size-3 text-neutral-400" /> Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value) || 15)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Sliders className="size-3 text-neutral-400" /> Prep Buffer (mins)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={formBufferBefore}
                    onChange={(e) => setFormBufferBefore(parseInt(e.target.value) || 0)}
                    placeholder="Before (e.g. 5)"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Sliders className="size-3 text-neutral-400" /> Wrap Buffer (mins)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={5}
                    value={formBufferAfter}
                    onChange={(e) => setFormBufferAfter(parseInt(e.target.value) || 0)}
                    placeholder="After (e.g. 10)"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                </div>
              </div>

              {/* Notice & Fatigue Caps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <Timer className="size-3 text-neutral-400" /> Min Notice (hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={formMinNoticeHours}
                    onChange={(e) => setFormMinNoticeHours(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 2 hours"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                  <p className="text-[10px] text-neutral-400">Prevents last-minute bookings.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-500" /> Max Bookings/Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formMaxBookingsPerDay}
                    onChange={(e) => setFormMaxBookingsPerDay(e.target.value)}
                    placeholder="Optional (e.g. 6)"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                  />
                  <p className="text-[10px] text-neutral-400">Protects host fatigue per day.</p>
                </div>
              </div>

              {/* Pricing & Stripe Monetization */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-[#f97316]" /> Paid Booking (Stripe)
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">Set to 0 for free</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-500">Price ($ USD/Amount)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={formPriceDollars}
                      onChange={(e) => setFormPriceDollars(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-xs px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-500">Currency</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value.toLowerCase())}
                      placeholder="usd"
                      className="w-full text-xs px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 uppercase font-mono focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                    />
                  </div>
                </div>
              </div>

              {/* AI Intent Routing Triggers */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                  <Sparkles className="size-3 text-orange-400" /> AI Intent Triggers (Keywords)
                </label>
                <input
                  type="text"
                  value={formIntentTriggers}
                  onChange={(e) => setFormIntentTriggers(e.target.value)}
                  placeholder="e.g. demo, walkthrough, sales, consultation"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                />
                <p className="text-[10px] text-neutral-400">
                  When visitors mention these keywords in chat, the AI will suggest this specific event type.
                </p>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded text-[#f97316] focus:ring-[#f97316]"
                />
                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  Allow bookings for this event type immediately (Active)
                </span>
              </label>

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEventType(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalBusy}
                  className="px-4 py-2 rounded-xl bg-[#f97316] hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {modalBusy && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingEventType ? "Update Event Type" : "Create Event Type"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
