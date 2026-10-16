"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Users,
  Sliders,
  Sparkles,
  ShieldAlert,
  Link2,
  FolderOpen,
  Calendar,
  Loader2,
  Check,
  RefreshCw,
  User,
  Camera,
  Upload,
  Trash2,
  Copy,
  Crown,
  ShieldCheck,
  Video,
  CalendarCheck,
  CalendarX,
  Link,
  History,
  Filter,
  FileText,
  Clock,
  Building2,
} from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import {
  MemberAvailabilityEditor,
  MemberOooEditor,
  MemberPermissionEditor,
  TeamTabCheckbox,
} from "../dashboard-controls";
import {
  CHATTY_TEAM_TABS,
  DEFAULT_ADMIN_TABS,
  DEFAULT_AGENT_TABS,
  OWNER_ONLY_TABS,
  ROLE_DEFAULT_TABS,
  ROLE_INFO,
  TAB_LABELS,
  toggleTabIntelligently,
  type ChattyTeamTab,
  type ChattyTeamRole,
} from "../dashboard-permissions";
import type { TeamMember, AdminAuditLog } from "../dashboard-types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface SettingsTabProps {
  canAccessTab: (tab: ChattyTeamTab | null) => boolean;
  myRole: string;
  inviteName: string;
  setInviteName: (n: string) => void;
  inviteEmail: string;
  setInviteEmail: (e: string) => void;
  inviteRole: ChattyTeamRole;
  setInviteRole: (r: ChattyTeamRole) => void;
  inviteTabs: ChattyTeamTab[];
  setInviteTabs: React.Dispatch<React.SetStateAction<ChattyTeamTab[]>>;
  invitingTeam: boolean;
  inviteTeamMember: () => Promise<void> | void;
  adminAuditLogs?: AdminAuditLog[];
  loadingAdminData?: boolean;
  loadAdminData?: (id: string) => Promise<void>;
  formatDateTime?: (dt: string) => string;
  teamMembers: TeamMember[];
  teamOwner?: TeamMember | null;
  editingMemberId: string | null;
  setEditingMemberId: (id: string | null) => void;
  editingAvailabilityId: string | null;
  setEditingAvailabilityId: (id: string | null) => void;
  toggleMemberBookable: (id: string, bookable: boolean) => Promise<void> | void;
  toggleMemberCalendarPreference: (id: string, bookOnOwnCalendar: boolean) => Promise<void> | void;
  updateTeamMember: (id: string, role: string, permissions: ChattyTeamTab[]) => Promise<void> | void;
  removeTeamMember: (id: string) => Promise<void> | void;
  reloadTeam?: () => Promise<void> | void;
  // AI Engine
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  byokConfigured: boolean;
  byokProvider: string;
  setByokProvider: (p: string) => void;
  byokModel: string;
  setByokModel: (m: string) => void;
  byokApiKeyInput: string;
  setByokApiKeyInput: (k: string) => void;
  savingByok: boolean;
  handleSaveByok: (clear?: boolean) => Promise<void> | void;
  systemInstructions: string;
  setSystemInstructions: (s: string) => void;
  isGeneratingInstructions: boolean;
  generateInstructions: () => Promise<void> | void;
  answerMode: "strict" | "hybrid" | "web";
  setAnswerMode: (m: "strict" | "hybrid" | "web") => void;
  strictMode: boolean;
  setStrictMode: (s: boolean) => void;
  showSenderTag: boolean;
  setShowSenderTag: (s: boolean) => void;
  hideBranding: boolean;
  setHideBranding: (h: boolean) => void;
  emailNotify: boolean;
  setEmailNotify: (e: boolean) => void;
  csatEnabled: boolean;
  setCsatEnabled: (c: boolean) => void;
  leadCaptureEnabled?: boolean;
  setLeadCaptureEnabled?: (l: boolean) => void;
  customMeetingLink?: string;
  setCustomMeetingLink?: (l: string) => void;
  // Guardrails & Language
  responseLanguage: string;
  setResponseLanguage: (l: string) => void;
  botCountry: string;
  setBotCountry: (c: string) => void;
  botTimezone: string;
  setBotTimezone: (t: string) => void;
  countryOptions: ModernSelectOption[];
  timezoneOptions: ModernSelectOption[];
  guardrailTopics: string;
  setGuardrailTopics: (t: string) => void;
  guardrailRefusalMessage: string;
  setGuardrailRefusalMessage: (m: string) => void;
  guardrailBlockProfanity: boolean;
  setGuardrailBlockProfanity: (b: boolean) => void;
  customCss: string;
  setCustomCss: (c: string) => void;
  customJs: string;
  setCustomJs: (j: string) => void;
  // Connections
  googleConnected: boolean;
  googleEmail?: string | null;
  microsoftConnected: boolean;
  microsoftEmail?: string | null;
  zoomConfigured: boolean;
  connectingProvider: "google" | "microsoft" | null;
  handleConnectCloud: (provider: "google" | "microsoft", mode?: "primary" | "add", targetBotId?: string) => Promise<void> | void;
  handleDisconnectCloud: (provider: "google" | "microsoft", targetBotId?: string) => Promise<void> | void;
  // Document Sync
  syncGoogleDrive: boolean;
  setSyncGoogleDrive: (s: boolean) => void;
  syncOutlookCalendar: boolean;
  setSyncOutlookCalendar: (s: boolean) => void;
  // Calendar Scheduling & Booking
  calendarSchedulingEnabled: boolean;
  setCalendarSchedulingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  googleConnectedAccountId: string | null;
  setGoogleConnectedAccountId: (id: string | null) => void;
  googleCalendarId: string;
  setGoogleCalendarId: (id: string) => void;
  googleCalendarName: string;
  setGoogleCalendarName: (name: string) => void;
  googleCalendarColor?: string;
  setGoogleCalendarColor?: (color: string) => void;
  meetingProvider: string;
  handleMeetingProviderChange: (v: string) => void;
  providerOptions: ModernSelectOption[];
  schedulingDuration: number;
  setSchedulingDuration: (d: number) => void;
  businessHoursStart: number;
  setBusinessHoursStart: (s: number) => void;
  businessHoursEnd: number;
  setBusinessHoursEnd: (e: number) => void;
  workingDays: string[];
  setWorkingDays: (d: string[]) => void;
  bufferMinutes: number;
  setBufferMinutes: (m: number) => void;
  advanceNoticeHours: number;
  setAdvanceNoticeHours: (h: number) => void;
  maxDailyMeetings: number;
  setMaxDailyMeetings: (m: number) => void;
  maxWeeklyMeetings: number;
  setMaxWeeklyMeetings: (m: number) => void;
  bookingRequireBusinessEmail: boolean;
  setBookingRequireBusinessEmail: (b: boolean) => void;
  bookingLimitOneActive: boolean;
  setBookingLimitOneActive: (b: boolean) => void;
  bookingBlockDisposableEmails: boolean;
  setBookingBlockDisposableEmails: (b: boolean) => void;
  bookingEmailVerification: boolean;
  setBookingEmailVerification: (b: boolean) => void;
  leadFields: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleInputChange: (setter: (val: any) => void, val: any) => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  user: SupabaseUser | null;
  botId: string | null;
  allBots?: Array<{ id: string; name: string; [key: string]: any }>;
  fetchWithFallback: (url: string, init?: RequestInit) => Promise<Response>;
  t: (key: string) => string;
}

export function SettingsTab({
  user,
  botId,
  allBots = [],
  fetchWithFallback,
  t,
  canAccessTab,
  myRole,
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteTabs,
  setInviteTabs,
  invitingTeam,
  inviteTeamMember,
  adminAuditLogs = [],
  loadingAdminData = false,
  loadAdminData,
  formatDateTime,
  teamMembers,
  teamOwner,
  editingMemberId,
  setEditingMemberId,
  editingAvailabilityId,
  setEditingAvailabilityId,
  toggleMemberBookable,
  toggleMemberCalendarPreference,
  updateTeamMember,
  removeTeamMember,
  reloadTeam,
  selectedModel,
  setSelectedModel,
  byokConfigured,
  byokProvider,
  setByokProvider,
  byokModel,
  setByokModel,
  byokApiKeyInput,
  setByokApiKeyInput,
  savingByok,
  handleSaveByok,
  systemInstructions,
  setSystemInstructions,
  isGeneratingInstructions,
  generateInstructions,
  answerMode,
  setAnswerMode,
  strictMode,
  setStrictMode,
  showSenderTag,
  setShowSenderTag,
  hideBranding,
  setHideBranding,
  emailNotify,
  setEmailNotify,
  csatEnabled,
  setCsatEnabled,
  leadCaptureEnabled = false,
  setLeadCaptureEnabled,
  customMeetingLink = "",
  setCustomMeetingLink,
  responseLanguage,
  setResponseLanguage,
  botCountry,
  setBotCountry,
  botTimezone,
  setBotTimezone,
  countryOptions,
  timezoneOptions,
  guardrailTopics,
  setGuardrailTopics,
  guardrailRefusalMessage,
  setGuardrailRefusalMessage,
  guardrailBlockProfanity,
  setGuardrailBlockProfanity,
  customCss,
  setCustomCss,
  customJs,
  setCustomJs,
  googleConnected,
  googleEmail,
  microsoftConnected,
  microsoftEmail,
  zoomConfigured,
  connectingProvider,
  handleConnectCloud,
  handleDisconnectCloud,
  syncGoogleDrive,
  setSyncGoogleDrive,
  syncOutlookCalendar,
  setSyncOutlookCalendar,
  calendarSchedulingEnabled,
  setCalendarSchedulingEnabled,
  googleConnectedAccountId,
  setGoogleConnectedAccountId,
  googleCalendarId,
  setGoogleCalendarId,
  googleCalendarName,
  setGoogleCalendarName,
  googleCalendarColor = "auto_multiple",
  setGoogleCalendarColor,
  meetingProvider,
  handleMeetingProviderChange,
  providerOptions,
  schedulingDuration,
  setSchedulingDuration,
  businessHoursStart,
  setBusinessHoursStart,
  businessHoursEnd,
  setBusinessHoursEnd,
  workingDays,
  setWorkingDays,
  bufferMinutes,
  setBufferMinutes,
  advanceNoticeHours,
  setAdvanceNoticeHours,
  maxDailyMeetings,
  setMaxDailyMeetings,
  maxWeeklyMeetings,
  setMaxWeeklyMeetings,
  bookingRequireBusinessEmail,
  setBookingRequireBusinessEmail,
  bookingLimitOneActive,
  setBookingLimitOneActive,
  bookingBlockDisposableEmails,
  setBookingBlockDisposableEmails,
  bookingEmailVerification,
  setBookingEmailVerification,
  leadFields,
  handleInputChange,
  showToast,
}: SettingsTabProps) {
  const [googleAccounts, setGoogleAccounts] = React.useState<Array<{ id: string | null; label: string; email: string }>>([]);
  const [googleCalendars, setGoogleCalendars] = React.useState<Array<{ id: string; summary: string; primary: boolean }>>([]);
  const [loadingCalendars, setLoadingCalendars] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    fetchWithFallback("/api/integrations/google/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const list: Array<{ id: string | null; label: string; email: string }> = [];
        if (data.primary_account && (data.primary_account.connected || data.primary_account.email)) {
          list.push({
            id: null,
            label: data.primary_account.label || "Workspace Default (Primary Account)",
            email: data.primary_account.email || "",
          });
        }
        if (Array.isArray(data.accounts)) {
          for (const a of data.accounts) {
            list.push({
              id: a.id,
              label: a.label || a.google_email || a.id,
              email: a.google_email || "",
            });
          }
        }
        setGoogleAccounts(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [googleConnected, googleConnectedAccountId, fetchWithFallback]);

  const loadCalendars = React.useCallback(() => {
    if (!googleConnected) return;
    setLoadingCalendars(true);
    const qs = new URLSearchParams();
    if (googleConnectedAccountId) qs.set("account_id", googleConnectedAccountId);
    if (botId) qs.set("bot_id", botId);
    fetchWithFallback(`/api/integrations/google/calendars?${qs.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.calendars)) {
          setGoogleCalendars(data.calendars);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCalendars(false));
  }, [googleConnected, googleConnectedAccountId, botId, fetchWithFallback]);

  const otherBots = React.useMemo(() => (allBots || []).filter((b) => b.id !== botId), [allBots, botId]);

  // User Profile Settings state (bot-isolated with optional sharing)
  const [profileName, setProfileName] = React.useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState<string | null>(null);
  const [profileRoleTitle, setProfileRoleTitle] = React.useState("Team Member");
  const [profileSource, setProfileSource] = React.useState<string>("custom");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const profileFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Team multi-bot sync state
  const [selectedTeamSourceBotId, setSelectedTeamSourceBotId] = React.useState("");
  const [syncingTeam, setSyncingTeam] = React.useState(false);

  React.useEffect(() => {
    if (!fetchWithFallback) return;
    let active = true;
    const url = botId ? `/api/agent/profile?bot_id=${encodeURIComponent(botId)}` : "/api/user/profile";
    fetchWithFallback(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setProfileName(data.display_name || "");
        setProfileAvatarUrl(data.avatar_url || null);
        setProfileRoleTitle(data.role_title || "Team Member");
        setProfileSource(data.is_bot_custom ? "custom" : "default");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [fetchWithFallback, botId]);

  const handleProfileSourceChange = async (val: string) => {
    setProfileSource(val);
    if (val === "default") {
      try {
        const res = await fetchWithFallback("/api/user/profile");
        if (res.ok) {
          const d = await res.json();
          setProfileName(d.display_name || "");
          setProfileAvatarUrl(d.avatar_url || null);
          setProfileRoleTitle("Team Member");
          showToast("Loaded workspace default profile. Click Save to apply to this bot.", "info");
        }
      } catch {}
    } else if (val !== "custom" && otherBots.some((b) => b.id === val)) {
      try {
        const res = await fetchWithFallback(`/api/agent/profile?bot_id=${encodeURIComponent(val)}`);
        if (res.ok) {
          const d = await res.json();
          setProfileName(d.display_name || "");
          setProfileAvatarUrl(d.avatar_url || null);
          setProfileRoleTitle(d.role_title || "Team Member");
          showToast("Loaded profile from selected bot. Click Save to apply to this bot.", "info");
        }
      } catch {}
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fetchWithFallback) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (profileName) fd.append("display_name", profileName);
      if (profileRoleTitle) fd.append("role_title", profileRoleTitle);
      if (botId) fd.append("bot_id", botId);
      const res = await fetchWithFallback("/api/user/avatar", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.avatar_url) {
          setProfileAvatarUrl(data.avatar_url);
          showToast("Profile photo uploaded successfully for this bot!", "success");
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg =
          typeof errData.detail === "string"
            ? errData.detail
            : Array.isArray(errData.detail)
            ? errData.detail.map((x: any) => x.msg || JSON.stringify(x)).join(", ")
            : errData.message || "Failed to upload photo";
        showToast(errMsg, "error");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast("Error uploading profile photo", "error");
    } finally {
      setUploadingAvatar(false);
      if (profileFileInputRef.current) profileFileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!fetchWithFallback) return;
    setSavingProfile(true);
    try {
      const res = await fetchWithFallback("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: profileName,
          avatar_url: profileAvatarUrl,
          role_title: profileRoleTitle,
          bot_id: botId,
        }),
      });
      if (res.ok) {
        showToast("Profile updated successfully for this bot!", "success");
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = typeof errData.detail === "string" ? errData.detail : "Failed to update profile";
        showToast(errMsg, "error");
      }
    } catch (err) {
      showToast("Error updating profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!fetchWithFallback) return;
    setSavingProfile(true);
    try {
      const res = await fetchWithFallback("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: profileName, role_title: profileRoleTitle, avatar_url: null, bot_id: botId }),
      });
      if (res.ok) {
        setProfileAvatarUrl(null);
        showToast("Profile photo removed for this bot", "info");
      }
    } catch {
      showToast("Error removing photo", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSyncTeamFromBot = async () => {
    if (!selectedTeamSourceBotId || !botId || !fetchWithFallback) return;
    setSyncingTeam(true);
    try {
      const res = await fetchWithFallback("/api/team/sync-from-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_bot_id: selectedTeamSourceBotId,
          target_bot_id: botId,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        showToast(`Successfully copied ${d.copied || 0} team member(s) to this bot!`, "success");
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.detail || "Failed to sync team", "error");
      }
    } catch {
      showToast("Error syncing team", "error");
    } finally {
      setSyncingTeam(false);
    }
  };

  const [editingCalendarId, setEditingCalendarId] = React.useState<string | null>(null);
  const [editingOooId, setEditingOooId] = React.useState<string | null>(null);
  const [memberGoogleEmail, setMemberGoogleEmail] = React.useState<Record<string, string>>({});
  const [memberMicrosoftEmail, setMemberMicrosoftEmail] = React.useState<Record<string, string>>({});
  const [memberZoomLink, setMemberZoomLink] = React.useState<Record<string, string>>({});
  const [savingMemberCalendar, setSavingMemberCalendar] = React.useState<string | null>(null);

  const handleSaveMemberCalendar = async (memberId: string) => {
    if (!botId || !fetchWithFallback) return;
    setSavingMemberCalendar(memberId);
    try {
      const gEmail = (memberGoogleEmail[memberId] ?? "").trim();
      const msEmail = (memberMicrosoftEmail[memberId] ?? "").trim();
      const zoom = (memberZoomLink[memberId] ?? "").trim();
      const res = await fetchWithFallback(`/api/team/${memberId}/calendar-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          google_email: gEmail,
          microsoft_email: msEmail,
          zoom_meeting_link: zoom,
        }),
      });
      if (res.ok) {
        showToast("Personal calendar connections updated.", "success");
        setEditingCalendarId(null);
        void reloadTeam?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.detail || "Couldn't update calendar settings.", "error");
      }
    } catch {
      showToast("Couldn't update calendar settings.", "error");
    } finally {
      setSavingMemberCalendar(null);
    }
  };

  const handleConnectTeammateCalendar = async (memberId: string, provider: "google" | "microsoft") => {
    if (!fetchWithFallback) return;
    try {
      const res = await fetchWithFallback(`/api/integrations/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          scope_type: "calendar",
          member_id: memberId,
          redirect_path: "/dashboard?tab=settings",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      showToast(`Could not start ${provider === "google" ? "Google" : "Outlook"} calendar authorization.`, "error");
    } catch {
      showToast(`Error connecting ${provider === "google" ? "Google" : "Outlook"} calendar.`, "error");
    }
  };

  const handleDisconnectTeammateCalendar = async (memberId: string, provider: "google" | "microsoft") => {
    if (!botId || !fetchWithFallback) return;
    try {
      const res = await fetchWithFallback(`/api/team/${memberId}/calendar-disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          provider,
        }),
      });
      if (res.ok) {
        showToast(`${provider === "google" ? "Google" : "Outlook"} calendar disconnected.`, "success");
        if (provider === "google") {
          setMemberGoogleEmail((p) => ({ ...p, [memberId]: "" }));
        } else {
          setMemberMicrosoftEmail((p) => ({ ...p, [memberId]: "" }));
        }
        void reloadTeam?.();
      } else {
        showToast(`Failed to disconnect ${provider} calendar.`, "error");
      }
    } catch {
      showToast(`Error disconnecting ${provider} calendar.`, "error");
    }
  };

  const [auditFilter, setAuditFilter] = React.useState<"all" | "roles" | "calendars" | "removals">("all");

  const teamAuditLogs = React.useMemo(() => {
    return adminAuditLogs.filter((a) => {
      const act = a.action || "";
      if (!act.startsWith("team_")) return false;
      if (auditFilter === "roles") return act === "team_member_invited" || act === "team_member_updated";
      if (auditFilter === "calendars") return act === "team_member_calendar_updated";
      if (auditFilter === "removals") return act === "team_member_removed" || act === "team_synced_from_bot";
      return true;
    });
  }, [adminAuditLogs, auditFilter]);

  React.useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  const currentMember = React.useMemo(() => {
    if (!user) return null;
    const userEmail = (user.email || "").toLowerCase().trim();
    const found = teamMembers.find(
      (m) => (m.email || "").toLowerCase().trim() === userEmail || m.id === user.id
    );
    if (found) return found;
    if (teamOwner && (teamOwner.email || "").toLowerCase().trim() === userEmail) {
      return teamOwner;
    }
    if (myRole === "owner") {
      return {
        id: user.id || "owner",
        email: user.email || "",
        name: (user as any).user_metadata?.full_name || (user as any).user_metadata?.name || "Account Owner",
        role: "owner",
        is_owner: true,
        google_connected: googleConnected,
        google_email: googleEmail,
        microsoft_connected: microsoftConnected,
        microsoft_email: microsoftEmail,
        book_on_own_calendar: true,
      } as TeamMember;
    }
    return null;
  }, [user, teamMembers, teamOwner, myRole, googleConnected, googleEmail, microsoftConnected, microsoftEmail]);

  return (
    <div className="max-w-4xl mx-auto w-full py-4 sm:py-6 px-3 sm:px-4 flex justify-center">
      <div className="w-full max-w-2xl p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-6 sm:space-y-8">

        {/* SECTION: YOUR PROFILE & PHOTO */}
        <div id="settings-profile-section" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <User className="size-4 text-[#f97316]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Bot Agent Profile & Photo</h3>
            </div>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
              Bot Isolated
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-1 leading-relaxed">
            Manage the agent identity, display name, and photo for this specific bot. Changes here will not affect your other bots unless you choose to share.
          </p>

          {/* Profile Source Dropdown */}
          {otherBots.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 sm:p-3.5 bg-neutral-100/60 dark:bg-neutral-950/60 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
              <div>
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Profile Source</span>
                <p className="text-[11px] text-neutral-400 mt-0.5">Use custom details or copy from another bot</p>
              </div>
              <div className="w-full sm:w-64">
                <ModernSelect
                  value={profileSource}
                  options={[
                    { value: "custom", label: "Custom (This bot only)" },
                    { value: "default", label: "Workspace default" },
                    ...otherBots.map((b) => ({ value: b.id, label: `Use from ${b.name}` })),
                  ]}
                  onChange={(v) => handleProfileSourceChange(v)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-3.5 sm:p-4 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/50">
            <div className="relative group shrink-0">
              <div className="size-16 rounded-full overflow-hidden border-2 border-white dark:border-neutral-800 shadow-sm bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-bold text-lg text-neutral-700 dark:text-neutral-200 select-none">
                {(uploadingAvatar || savingProfile) ? (
                  <Loader2 className="size-6 text-[#f97316] animate-spin" />
                ) : profileAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileAvatarUrl} alt={profileName || "User"} className="size-full object-cover" />
                ) : (
                  <span>{(profileName?.[0] || user?.email?.[0] || "U").toUpperCase()}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => profileFileInputRef.current?.click()}
                disabled={uploadingAvatar}
                title="Change profile photo"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#f97316] text-white shadow hover:opacity-90 cursor-pointer disabled:opacity-50 transition-opacity"
              >
                {uploadingAvatar ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
              </button>
              <input
                ref={profileFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder={user?.email ? user.email.split("@")[0] : "Your Name"}
                    className="w-full text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Role / Title</label>
                  <input
                    type="text"
                    value={profileRoleTitle}
                    onChange={(e) => setProfileRoleTitle(e.target.value)}
                    placeholder="e.g. Support Specialist"
                    className="w-full text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-neutral-200/50 dark:border-neutral-800/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => profileFileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-3 py-2 sm:py-1.5 text-xs sm:text-[11px] font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {uploadingAvatar ? <Loader2 className="size-3.5 sm:size-3 animate-spin" /> : <Upload className="size-3.5 sm:size-3" />}
                    {profileAvatarUrl ? "Upload New Photo" : "Upload Photo"}
                  </button>
                  {profileAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={savingProfile}
                      className="px-2.5 py-2 sm:py-1.5 text-xs sm:text-[11px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="size-3.5 sm:size-3" />
                      Remove
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-4 py-2 sm:py-1.5 text-xs sm:text-[11px] font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {savingProfile ? <Loader2 className="size-3.5 sm:size-3 animate-spin" /> : <Check className="size-3.5 sm:size-3" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

                {/* SECTION 0: TEAM */}
                {canAccessTab("team") && (() => {
                  // What THIS caller may grant to someone else - an admin
                  // managing the roster can hand out any tab except the
                  // owner-only ones (billing/BYOK/webhooks), matching the
                  // backend's OWNER_ONLY_TABS enforcement.
                  const grantableTabs = CHATTY_TEAM_TABS.filter((t) => myRole === "owner" || !OWNER_ONLY_TABS.has(t));
                  return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-[#f97316]" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Team Roster</h3>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                        Unique to this Bot
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 -mt-2">
                      Invite teammates to help manage this bot. Each bot maintains its own isolated team roster. You can invite dedicated teammates or copy an existing team roster from another bot below.
                    </p>

                    {/* Team Isolation & Sharing Options */}
                    {otherBots.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-neutral-100/60 dark:bg-neutral-950/60 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                        <div>
                          <div className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">Team Roster Source</div>
                          <p className="text-[10px] text-neutral-400">Keep unique or copy team members from another bot</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <div className="w-full sm:w-56">
                            <ModernSelect
                              value={selectedTeamSourceBotId}
                              options={[
                                { value: "", label: "Dedicated (Unique to this bot)" },
                                ...otherBots.map((b) => ({ value: b.id, label: `Copy team from ${b.name}` })),
                              ]}
                              onChange={(v) => setSelectedTeamSourceBotId(v)}
                            />
                          </div>
                          {selectedTeamSourceBotId && (
                            <button
                              type="button"
                              onClick={handleSyncTeamFromBot}
                              disabled={syncingTeam}
                              className="px-3 py-1.5 text-[11px] font-semibold bg-[#f97316] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              {syncingTeam ? <Loader2 className="size-3 animate-spin" /> : <Copy className="size-3" />}
                              Sync Team
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-2">
                      <input
                        type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Full name"
                        className="w-full sm:w-40 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <input
                        type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                        className="w-full sm:flex-1 min-w-0 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex-1 sm:w-40 sm:flex-initial">
                          <ModernSelect
                            align="right"
                            value={inviteRole}
                            options={[
                              { value: "admin", label: "Admin", hint: "Full operational access (settings, team, knowledge, integrations)" },
                              { value: "agent", label: "Agent", hint: "Support agent (inbox chats & calendar meetings)" },
                              { value: "editor", label: "Editor", hint: "Content editor (knowledge training & widget styling)" },
                              { value: "billing_manager", label: "Billing Manager", hint: "Financial invoices & plan subscriptions" },
                              { value: "viewer", label: "Viewer", hint: "Read-only conversations and meeting schedules" },
                            ]}
                            onChange={(v) => {
                              const role = v as ChattyTeamRole;
                              setInviteRole(role);
                              const defaults = ROLE_DEFAULT_TABS[role] || DEFAULT_AGENT_TABS;
                              setInviteTabs(defaults.filter((t) => grantableTabs.includes(t)) as ChattyTeamTab[]);
                            }}
                          />
                        </div>
                        <button onClick={inviteTeamMember} disabled={invitingTeam || !inviteEmail.includes("@") || !inviteName.trim()}
                          className="flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-[11px] font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap cursor-pointer">
                          {invitingTeam ? "Inviting…" : "Invite"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                          Accessible Dashboard Tabs
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          Intelligently links companion tabs (e.g. Inbox + Meetings)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {grantableTabs.map((tab) => (
                          <TeamTabCheckbox
                            key={tab}
                            checked={inviteTabs.includes(tab)}
                            onChange={(checked) => setInviteTabs((p) => toggleTabIntelligently(p, tab, checked, grantableTabs))}
                            label={TAB_LABELS[tab] || tab}
                          />
                        ))}
                      </div>
                    </div>

                    {/* PINNED ACCOUNT OWNER CARD */}
                    {teamOwner && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/25 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative size-8 rounded-full overflow-hidden bg-amber-500/20 border border-amber-500/40 shrink-0 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-300 select-none">
                              {teamOwner.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={teamOwner.avatar_url} alt={teamOwner.name || teamOwner.email} className="size-full object-cover" />
                              ) : (
                                (teamOwner.name || teamOwner.email || "O").charAt(0).toUpperCase()
                              )}
                              <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                                <Crown className="size-2.5" />
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                  {teamOwner.name || teamOwner.email}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                  <ShieldCheck className="size-2.5" /> Account Owner
                                </span>
                              </div>
                              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                                {teamOwner.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                teamOwner.google_connected
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                              }`}
                            >
                              <CalendarCheck className="size-2.5" />
                              Google: {teamOwner.google_connected ? "Synced" : "Disconnected"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                teamOwner.microsoft_connected
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
                              }`}
                            >
                              <CalendarCheck className="size-2.5" />
                              Microsoft: {teamOwner.microsoft_connected ? "Synced" : "Disconnected"}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-normal">
                          Primary account creator with full unrestricted ownership across all bot settings, integrations, billing, and team seats. Protected from removal or demotion.
                        </p>
                      </div>
                    )}

                    {teamMembers.length > 0 && (
                      <div className="space-y-2">
                        {teamMembers.map((m) => {
                          const memberTabs = ((m.permissions && m.permissions.length > 0
                            ? m.permissions
                            : ROLE_DEFAULT_TABS[m.role as ChattyTeamRole] || [])) as ChattyTeamTab[];
                          const isEditing = editingMemberId === m.id;
                          const isEditingAvailability = editingAvailabilityId === m.id;
                          const isEditingCalendar = editingCalendarId === m.id;
                          const isSelf = !!user?.email && user.email.toLowerCase() === m.email.toLowerCase();
                          const canManageAvailability = canAccessTab("team") || isSelf;
                          const roleInfo = ROLE_INFO[m.role as ChattyTeamRole] || ROLE_INFO.agent;
                          return (
                            <div key={m.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-850 space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="size-7 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 flex items-center justify-center text-[11px] font-bold text-neutral-600 dark:text-neutral-300 select-none">
                                    {m.avatar_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={m.avatar_url} alt={m.name || m.email} className="size-full object-cover" />
                                    ) : (
                                      (m.name || m.email || "A").charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">{m.name || m.email}</span>
                                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${roleInfo.badgeClasses}`}>
                                        {roleInfo.label}
                                      </span>
                                    </div>
                                    {m.name && <div className="text-[10px] text-neutral-400 truncate">{m.email}</div>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center shrink-0">
                                  {canManageAvailability && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (editingCalendarId === m.id) {
                                          setEditingCalendarId(null);
                                        } else {
                                          setMemberGoogleEmail((p) => ({ ...p, [m.id]: p[m.id] ?? (m.google_email || "") }));
                                          setMemberMicrosoftEmail((p) => ({ ...p, [m.id]: p[m.id] ?? (m.microsoft_email || "") }));
                                          setMemberZoomLink((p) => ({ ...p, [m.id]: p[m.id] ?? (m.zoom_meeting_link || "") }));
                                          setEditingCalendarId(m.id);
                                        }
                                      }}
                                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                        isEditingCalendar
                                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                      }`}
                                    >
                                      <Calendar className="size-3 text-[#f97316]" />
                                      <span>{isEditingCalendar ? "Close Calendar" : "Calendar"}</span>
                                    </button>
                                  )}
                                  {canManageAvailability && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingAvailabilityId(isEditingAvailability ? null : m.id)}
                                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                        isEditingAvailability
                                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                      }`}
                                    >
                                      <Clock className="size-3 text-blue-500" />
                                      <span>{isEditingAvailability ? "Close Hours" : "Hours"}</span>
                                    </button>
                                  )}
                                  {canManageAvailability && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingOooId(editingOooId === m.id ? null : m.id)}
                                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                        editingOooId === m.id
                                          ? "bg-amber-500 text-white border-amber-500"
                                          : m.ooo_active
                                          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                      }`}
                                    >
                                      <span className="text-xs">🌴</span>
                                      <span>{editingOooId === m.id ? "Close OOO" : m.ooo_active ? "On Leave" : "Out of Office"}</span>
                                    </button>
                                  )}
                                  {canAccessTab("team") && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingMemberId(isEditing ? null : m.id)}
                                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                        isEditing
                                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white"
                                          : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                      }`}
                                    >
                                      <ShieldCheck className="size-3 text-purple-500" />
                                      <span>{isEditing ? "Close Perms" : "Permissions"}</span>
                                    </button>
                                  )}
                                  {canAccessTab("team") && !m.is_owner && (
                                    <button
                                      type="button"
                                      onClick={() => removeTeamMember(m.id)}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer shadow-2xs"
                                      title="Remove team member"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Calendar connection status badges with 1-click connect */}
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                {m.google_connected ? (
                                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                    <Check className="size-3" />
                                    <span>Google Calendar ({m.google_email || "Connected"})</span>
                                    {canManageAvailability && (
                                      <button
                                        type="button"
                                        onClick={() => handleDisconnectTeammateCalendar(m.id, "google")}
                                        className="text-neutral-400 hover:text-red-500 ml-1 font-bold cursor-pointer"
                                        title="Disconnect Google Calendar"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-800">
                                    <span>Google Calendar: Off</span>
                                    {canManageAvailability && (
                                      <button
                                        type="button"
                                        onClick={() => handleConnectTeammateCalendar(m.id, "google")}
                                        className="text-[#f97316] hover:underline font-bold ml-0.5 cursor-pointer"
                                      >
                                        + Connect Google
                                      </button>
                                    )}
                                  </div>
                                )}

                                {m.microsoft_connected ? (
                                  <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                    <Check className="size-3" />
                                    <span>Outlook Calendar ({m.microsoft_email || "Connected"})</span>
                                    {canManageAvailability && (
                                      <button
                                        type="button"
                                        onClick={() => handleDisconnectTeammateCalendar(m.id, "microsoft")}
                                        className="text-neutral-400 hover:text-red-500 ml-1 font-bold cursor-pointer"
                                        title="Disconnect Outlook Calendar"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-800">
                                    <span>MS Calendar: Off</span>
                                    {canManageAvailability && (
                                      <button
                                        type="button"
                                        onClick={() => handleConnectTeammateCalendar(m.id, "microsoft")}
                                        className="text-blue-600 hover:underline font-bold ml-0.5 cursor-pointer"
                                      >
                                        + Connect Outlook
                                      </button>
                                    )}
                                  </div>
                                )}

                                {m.ooo_active && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                    🌴 Out of Office {m.ooo_backup_email ? `(Covered by ${m.ooo_backup_email})` : ""}
                                  </span>
                                )}

                                {m.zoom_meeting_link && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 truncate max-w-xs">
                                    <Video className="size-3 shrink-0" />
                                    <span className="truncate">Zoom: {m.zoom_meeting_link}</span>
                                  </span>
                                )}
                              </div>

                              {!isEditing && memberTabs.length > 0 && (
                                <p className="text-[10px] text-neutral-400 truncate">
                                  <span className="font-medium text-neutral-500">Accessible:</span> {memberTabs.map((t) => TAB_LABELS[t] || t).join(", ")}
                                </p>
                              )}

                              {canAccessTab("team") && (
                                <div className="space-y-1.5 pt-1 border-t border-neutral-100 dark:border-neutral-850">
                                  <TeamTabCheckbox
                                    checked={!!m.bookable}
                                    onChange={(checked) => toggleMemberBookable(m.id, checked)}
                                    label="Bookable for round-robin meetings"
                                  />
                                  {m.bookable && (
                                    <div className="pl-5">
                                      <TeamTabCheckbox
                                        checked={m.book_on_own_calendar !== false}
                                        onChange={(checked) => toggleMemberCalendarPreference(m.id, checked)}
                                        label={m.book_on_own_calendar !== false ? "Books on their personal calendar" : "Books on your bot owner calendar instead"}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* PERSONAL CALENDAR & VIDEO EDITOR (Tier 3 Calendar-Only) */}
                              {isEditingCalendar && (
                                <div className="p-3.5 bg-neutral-100/70 dark:bg-neutral-900/80 rounded-xl border border-neutral-200/70 dark:border-neutral-800 space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="size-3.5 text-[#f97316]" />
                                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                                          Personal Calendar &amp; Video Room (Tier 3)
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                        Teammate schedule connection for appointments and round-robin booking.
                                      </p>
                                    </div>
                                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 self-start sm:self-auto">
                                      <ShieldCheck className="size-2.5" /> Calendar-Only Scopes
                                    </span>
                                  </div>

                                  {/* Privacy Guarantee Banner */}
                                  <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-[10px] text-blue-900 dark:text-blue-200 flex items-start gap-2">
                                    <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <span>
                                      <strong>Strict Privacy:</strong> Teammates only grant calendar availability. Antigravity/Chatty never accesses personal emails, messages, Google Drive, OneDrive, or contacts. Company files and AI knowledge are strictly isolated to Workspace accounts.
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    {/* Google Calendar Card */}
                                    <div className="p-3 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                          <CalendarCheck className="size-3.5 text-red-500" /> Google Calendar
                                        </span>
                                        {m.google_connected && (
                                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                                            Connected
                                          </span>
                                        )}
                                      </div>
                                      {m.google_connected ? (
                                        <div className="space-y-2">
                                          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium truncate">
                                            {m.google_email || "Google Calendar Active"}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => handleDisconnectTeammateCalendar(m.id, "google")}
                                            className="px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded border border-red-200 dark:border-red-900 transition-colors cursor-pointer"
                                          >
                                            Disconnect
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <button
                                            type="button"
                                            onClick={() => handleConnectTeammateCalendar(m.id, "google")}
                                            className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                          >
                                            <Calendar className="size-3" /> Connect Google
                                          </button>
                                          <div className="pt-1">
                                            <label className="block text-[9px] text-neutral-400 mb-0.5">Or set email manually</label>
                                            <input
                                              type="email"
                                              placeholder="agent@company.com"
                                              value={memberGoogleEmail[m.id] ?? (m.google_email || "")}
                                              onChange={(e) => setMemberGoogleEmail((p) => ({ ...p, [m.id]: e.target.value }))}
                                              className="w-full text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Microsoft Outlook Card */}
                                    <div className="p-3 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                          <CalendarCheck className="size-3.5 text-blue-500" /> Outlook Calendar
                                        </span>
                                        {m.microsoft_connected && (
                                          <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                                            Connected
                                          </span>
                                        )}
                                      </div>
                                      {m.microsoft_connected ? (
                                        <div className="space-y-2">
                                          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium truncate">
                                            {m.microsoft_email || "Outlook Calendar Active"}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => handleDisconnectTeammateCalendar(m.id, "microsoft")}
                                            className="px-2.5 py-1 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded border border-red-200 dark:border-red-900 transition-colors cursor-pointer"
                                          >
                                            Disconnect
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <button
                                            type="button"
                                            onClick={() => handleConnectTeammateCalendar(m.id, "microsoft")}
                                            className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                          >
                                            <Calendar className="size-3" /> Connect Outlook
                                          </button>
                                          <div className="pt-1">
                                            <label className="block text-[9px] text-neutral-400 mb-0.5">Or set email manually</label>
                                            <input
                                              type="email"
                                              placeholder="agent@outlook.com"
                                              value={memberMicrosoftEmail[m.id] ?? (m.microsoft_email || "")}
                                              onChange={(e) => setMemberMicrosoftEmail((p) => ({ ...p, [m.id]: e.target.value }))}
                                              className="w-full text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Personal Zoom Room */}
                                  <div className="p-3 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 space-y-1.5">
                                    <label className="block text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                      <Video className="size-3.5 text-blue-500" /> Personal Zoom Meeting Room (PMI Link)
                                    </label>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="url"
                                        placeholder="https://zoom.us/j/123456789"
                                        value={memberZoomLink[m.id] ?? (m.zoom_meeting_link || "")}
                                        onChange={(e) => setMemberZoomLink((p) => ({ ...p, [m.id]: e.target.value }))}
                                        className="flex-1 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#f97316]"
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => setEditingCalendarId(null)}
                                          className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                                        >
                                          Done
                                        </button>
                                        <button
                                          type="button"
                                          disabled={savingMemberCalendar === m.id}
                                          onClick={() => handleSaveMemberCalendar(m.id)}
                                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#f97316] hover:opacity-90 rounded-lg shadow-sm transition-opacity cursor-pointer whitespace-nowrap"
                                        >
                                          {savingMemberCalendar === m.id ? "Saving…" : "Save Zoom & Emails"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {isEditing && (
                                <MemberPermissionEditor
                                  key={`${m.id}:${m.role}:${memberTabs.join(",")}`}
                                  role={m.role}
                                  permissions={memberTabs}
                                  grantableTabs={grantableTabs}
                                  onSave={(role, permissions) => updateTeamMember(m.id, role, permissions)}
                                  onCancel={() => setEditingMemberId(null)}
                                />
                              )}

                              {editingOooId === m.id && botId && (
                                <MemberOooEditor
                                  key={`ooo-${m.id}-${m.ooo_active}`}
                                  member={m}
                                  botId={botId}
                                  allMembers={teamMembers}
                                  showToast={showToast}
                                  fetchWithFallback={fetchWithFallback}
                                  onSaved={() => void reloadTeam?.()}
                                />
                              )}

                              {isEditingAvailability && botId && (
                                <MemberAvailabilityEditor
                                  memberId={m.id} botId={botId}
                                  showToast={showToast} fetchWithFallback={fetchWithFallback}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* TEAM COLLABORATION & ACTIVITY AUDIT TRAIL TABLE */}
                    <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <History className="size-4 text-[#f97316]" />
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                              Team Activity & Audit Trail
                            </h4>
                            <p className="text-[10px] text-neutral-400">
                              Immutable ledger of team invitations, role changes, permission edits, and calendar connections
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {loadAdminData && botId && (
                            <button
                              type="button"
                              onClick={() => loadAdminData(botId)}
                              disabled={loadingAdminData}
                              className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg px-2.5 py-1.5 cursor-pointer flex items-center gap-1.5 transition text-neutral-700 dark:text-neutral-300"
                            >
                              <RefreshCw className={`size-3 ${loadingAdminData ? "animate-spin" : ""}`} />
                              Refresh Log
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(
                          [
                            { id: "all", label: "All Team Events" },
                            { id: "roles", label: "Roles & Permissions" },
                            { id: "calendars", label: "Calendar Connections" },
                            { id: "removals", label: "Invites & Removals" },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setAuditFilter(tab.id)}
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer ${
                              auditFilter === tab.id
                                ? "bg-[#f97316] text-white shadow-xs"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Responsive Table */}
                      <div className="overflow-x-auto bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl [scrollbar-width:thin]">
                        <table className="w-full border-collapse text-left text-xs min-w-[640px]">
                          <thead className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 font-semibold text-neutral-600 dark:text-neutral-400 text-[11px]">
                            <tr>
                              <th className="px-3.5 py-2.5 whitespace-nowrap w-36">Action</th>
                              <th className="px-3.5 py-2.5 min-w-[240px]">Event Details</th>
                              <th className="px-3.5 py-2.5 whitespace-nowrap w-44">Performed By</th>
                              <th className="px-3.5 py-2.5 whitespace-nowrap w-36">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850 text-neutral-700 dark:text-neutral-300 text-[11px]">
                            {teamAuditLogs.map((log) => {
                              const act = log.action || "";
                              let badgeColor = "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
                              let label = act.replace(/^team_/, "").replace(/_/g, " ");

                              if (act === "team_member_invited") {
                                badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800";
                                label = "Member Invited";
                              } else if (act === "team_member_updated") {
                                badgeColor = "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/60 dark:border-purple-800";
                                label = "Role / Permissions";
                              } else if (act === "team_member_calendar_updated") {
                                badgeColor = "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300/60 dark:border-blue-800";
                                label = "Calendar Linked";
                              } else if (act === "team_member_removed") {
                                badgeColor = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800";
                                label = "Member Removed";
                              } else if (act === "team_synced_from_bot") {
                                badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800";
                                label = "Team Synced";
                              }

                              return (
                                <tr key={log.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-900/60 transition-colors">
                                  <td className="px-3.5 py-2.5 whitespace-nowrap">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${badgeColor}`}>
                                      {label}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 min-w-[240px] text-neutral-800 dark:text-neutral-200 leading-relaxed break-words">
                                    {log.details || "—"}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                                    {log.performed_by || "system"}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-neutral-400 dark:text-neutral-500 whitespace-nowrap text-[10px]">
                                    {log.created_at && formatDateTime ? formatDateTime(log.created_at) : log.created_at || "—"}
                                  </td>
                                </tr>
                              );
                            })}

                            {teamAuditLogs.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400 dark:text-neutral-500 space-y-1">
                                  <FileText className="size-6 mx-auto text-neutral-300 dark:text-neutral-700" />
                                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                                    No team audit events found
                                  </div>
                                  <p className="text-[10px] text-neutral-400">
                                    Member invitations, permission changes, and calendar updates will automatically appear here.
                                  </p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* SECTION 1: AI ENGINE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <Sliders className="size-4 text-[#f97316]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">AI Engine Settings</h3>
                  </div>

                  {/* Model Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">AI Foundation Model</label>
                    <ModernSelect
                      value={selectedModel}
                      onChange={(v) => handleInputChange(setSelectedModel, v)}
                      options={[
                        { value: "gemini", label: "Gemini 3.5 Flash", hint: "Default - included, no setup" },
                        { value: "gpt5", label: "GPT-5.3 Turbo", hint: "Requires your OpenAI key below" },
                        { value: "claude", label: "Claude Opus", hint: "Requires your Anthropic key below" },
                        { value: "mistral", label: "Mistral Large", hint: "Requires your OpenRouter key below" },
                      ]}
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">Selected model handles logic & responses inside your widget.</p>
                  </div>

                  {/* Knowledge Source */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Knowledge Source</label>
                    <ModernSelect
                      value={answerMode}
                      onChange={(v) => handleInputChange(setAnswerMode, v as "strict" | "hybrid" | "web")}
                      options={[
                        { value: "strict", label: "Knowledge base only", hint: "Safest - answers strictly from your trained sources" },
                        { value: "hybrid", label: "Knowledge base + AI knowledge", hint: "Falls back to the model's general knowledge" },
                        { value: "web", label: "Knowledge base + web search", hint: "Looks up live info on the web when needed" },
                      ]}
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                      {answerMode === "strict" && "Only answers from your trained knowledge - best for accuracy and avoiding made-up info."}
                      {answerMode === "hybrid" && "Answers from your knowledge first, then the model's own general knowledge if needed."}
                      {answerMode === "web" && "Adds a live web-search tool so the bot can pull current information beyond your knowledge base."}
                    </p>
                  </div>

                  {/* BYOK - required for any non-Gemini model */}
                  {selectedModel !== "gemini" && (() => {
                    const providerForModel: Record<string, { provider: string; label: string; placeholder: string }> = {
                      gpt5: { provider: "openai", label: "OpenAI API key", placeholder: "sk-..." },
                      claude: { provider: "anthropic", label: "Anthropic API key", placeholder: "sk-ant-..." },
                      mistral: { provider: "openrouter", label: "OpenRouter API key", placeholder: "sk-or-..." },
                    };
                    const expected = providerForModel[selectedModel];
                    return (
                      <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Bring Your Own Key (BYOK)</span>
                          {byokConfigured && byokProvider === expected?.provider && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                              <Check className="size-2.5" /> Configured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                          This model runs on your own {expected?.label.replace(" API key", "")} key - Chatty doesn&apos;t supply one. Note: lead capture and meeting booking tools currently only work on Gemini; BYOK models still answer from your knowledge base.
                        </p>
                        <input
                          type="password"
                          value={byokApiKeyInput}
                          onChange={(e) => setByokApiKeyInput(e.target.value)}
                          placeholder={byokConfigured ? "•••••••••••••••• (saved - enter a new key to replace)" : expected?.placeholder}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <input
                          type="text"
                          value={byokModel}
                          onChange={(e) => setByokModel(e.target.value)}
                          placeholder="Model override (optional, e.g. gpt-4o-mini)"
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setByokProvider(expected!.provider); handleSaveByok(false); }}
                            disabled={savingByok || !byokApiKeyInput.trim()}
                            className="px-3 py-2 sm:py-1.5 bg-[#f97316] text-white rounded-lg text-xs sm:text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                          >
                            {savingByok ? "Saving…" : "Save key"}
                          </button>
                          {byokConfigured && (
                            <button
                              onClick={() => handleSaveByok(true)}
                              disabled={savingByok}
                              className="px-3 py-2 sm:py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-xs sm:text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                            >
                              Remove key
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* System Instructions / Guardrails */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">System Instructions / Guardrails</label>
                      <button
                        onClick={generateInstructions}
                        disabled={isGeneratingInstructions}
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#f97316] hover:text-[#ea6b0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Auto-generate from trained knowledge"
                      >
                        {isGeneratingInstructions
                          ? <Loader2 className="size-3 animate-spin" />
                          : <Sparkles className="size-3" />}
                        {isGeneratingInstructions ? "Generating…" : "Auto-generate"}
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={systemInstructions}
                      onChange={(e) => handleInputChange(setSystemInstructions, e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">Configures behavior limitations and answers guidelines.</p>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-1 pt-1 divide-y divide-neutral-100/70 dark:divide-neutral-800/70">
                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Knowledge Base Strict Mode</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Only answer questions using verified trained memory sources.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setStrictMode, !strictMode)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          strictMode ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${strictMode ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Email Lead Alerts</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Receive instant email updates when visitors submit contact info.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setEmailNotify, !emailNotify)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          emailNotify ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${emailNotify ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Remove &quot;Powered by Chatty&quot; Branding</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Hide the Chatty footer mark in the widget (white-label).</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setHideBranding, !hideBranding)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          hideBranding ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${hideBranding ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Show AI / Human Tag</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Label each reply in the widget as &quot;AI&quot; or &quot;Human agent&quot;.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setShowSenderTag, !showSenderTag)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          showSenderTag ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${showSenderTag ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Post-Chat Rating Prompt</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Ask visitors to rate the conversation when they close the widget.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setCsatEnabled, !csatEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          csatEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${csatEnabled ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-start sm:items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Inline Lead Capture Form</span>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Show email/contact collection prompt inside chat messages for visitors.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (setLeadCaptureEnabled) {
                            handleInputChange(setLeadCaptureEnabled, !leadCaptureEnabled);
                          }
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                          leadCaptureEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${leadCaptureEnabled ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 1B: GUARDRAILS & LANGUAGE */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-[#f97316]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Guardrails & Language</h3>
                    </div>
                    <button
                      onClick={generateInstructions}
                      disabled={isGeneratingInstructions}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#f97316] hover:text-[#ea6b0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Auto-generate from trained knowledge (same generator as System Instructions above)"
                    >
                      {isGeneratingInstructions
                        ? <Loader2 className="size-3 animate-spin" />
                        : <Sparkles className="size-3" />}
                      {isGeneratingInstructions ? "Generating…" : "Auto-generate"}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Off-Topic Refusal</label>
                    <textarea
                      rows={2}
                      value={guardrailTopics}
                      onChange={(e) => handleInputChange(setGuardrailTopics, e.target.value)}
                      placeholder="e.g. politics, medical advice, legal advice, competitor products"
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">Comma-separated topics the assistant should always decline to discuss. Leave empty to allow any on-topic discussion.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Custom Refusal Message</label>
                    <input
                      type="text"
                      value={guardrailRefusalMessage}
                      onChange={(e) => handleInputChange(setGuardrailRefusalMessage, e.target.value)}
                      placeholder="Sorry, I can't help with that - but I'm happy to answer questions about our product!"
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                  </div>

                  <div className="flex items-start sm:items-center justify-between gap-3 py-2.5 border-t border-neutral-100/70 dark:border-neutral-800/70">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">Block Profanity & Abuse</span>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 leading-normal">Refuse to engage with abusive or profane visitor messages.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setGuardrailBlockProfanity, !guardrailBlockProfanity)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                        guardrailBlockProfanity ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${guardrailBlockProfanity ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Response Language</label>
                    <ModernSelect
                      value={responseLanguage}
                      onChange={(v) => handleInputChange(setResponseLanguage, v)}
                      options={[
                        { value: "", label: "Mirror visitor's language (default)" },
                        // - Most common -
                        { value: "en",    label: "English" },
                        { value: "es",    label: "Spanish" },
                        { value: "es-MX", label: "Spanish (Mexico)" },
                        { value: "zh",    label: "Chinese (Simplified)" },
                        { value: "zh-TW", label: "Chinese (Traditional)" },
                        { value: "hi",    label: "Hindi" },
                        { value: "ar",    label: "Arabic" },
                        { value: "pt",    label: "Portuguese" },
                        { value: "pt-BR", label: "Portuguese (Brazil)" },
                        { value: "fr",    label: "French" },
                        { value: "ru",    label: "Russian" },
                        { value: "de",    label: "German" },
                        { value: "ja",    label: "Japanese" },
                        { value: "ko",    label: "Korean" },
                        { value: "it",    label: "Italian" },
                        { value: "tr",    label: "Turkish" },
                        { value: "vi",    label: "Vietnamese" },
                        { value: "pl",    label: "Polish" },
                        { value: "nl",    label: "Dutch" },
                        { value: "th",    label: "Thai" },
                        { value: "id",    label: "Indonesian" },
                        { value: "ms",    label: "Malay" },
                        { value: "tl",    label: "Filipino (Tagalog)" },
                        { value: "sv",    label: "Swedish" },
                        { value: "uk",    label: "Ukrainian" },
                        { value: "fa",    label: "Persian (Farsi)" },
                        { value: "ur",    label: "Urdu" },
                        { value: "bn",    label: "Bengali" },
                        { value: "sw",    label: "Swahili" },
                        { value: "ta",    label: "Tamil" },
                        { value: "te",    label: "Telugu" },
                        { value: "mr",    label: "Marathi" },
                        { value: "gu",    label: "Gujarati" },
                        { value: "kn",    label: "Kannada" },
                        { value: "ml",    label: "Malayalam" },
                        { value: "pa",    label: "Punjabi" },
                        { value: "ne",    label: "Nepali" },
                        { value: "si",    label: "Sinhala" },
                        // - European -
                        { value: "da",    label: "Danish" },
                        { value: "fi",    label: "Finnish" },
                        { value: "no",    label: "Norwegian" },
                        { value: "cs",    label: "Czech" },
                        { value: "sk",    label: "Slovak" },
                        { value: "ro",    label: "Romanian" },
                        { value: "hu",    label: "Hungarian" },
                        { value: "bg",    label: "Bulgarian" },
                        { value: "hr",    label: "Croatian" },
                        { value: "sr",    label: "Serbian" },
                        { value: "bs",    label: "Bosnian" },
                        { value: "sl",    label: "Slovenian" },
                        { value: "mk",    label: "Macedonian" },
                        { value: "sq",    label: "Albanian" },
                        { value: "lt",    label: "Lithuanian" },
                        { value: "lv",    label: "Latvian" },
                        { value: "et",    label: "Estonian" },
                        { value: "el",    label: "Greek" },
                        { value: "ca",    label: "Catalan" },
                        { value: "gl",    label: "Galician" },
                        { value: "eu",    label: "Basque" },
                        { value: "cy",    label: "Welsh" },
                        { value: "ga",    label: "Irish" },
                        { value: "is",    label: "Icelandic" },
                        { value: "mt",    label: "Maltese" },
                        { value: "lb",    label: "Luxembourgish" },
                        { value: "yi",    label: "Yiddish" },
                        // - Central & Eastern Asia -
                        { value: "mn",    label: "Mongolian" },
                        { value: "my",    label: "Burmese (Myanmar)" },
                        { value: "km",    label: "Khmer" },
                        { value: "lo",    label: "Lao" },
                        { value: "ka",    label: "Georgian" },
                        { value: "hy",    label: "Armenian" },
                        { value: "az",    label: "Azerbaijani" },
                        { value: "kk",    label: "Kazakh" },
                        { value: "ky",    label: "Kyrgyz" },
                        { value: "uz",    label: "Uzbek" },
                        { value: "tg",    label: "Tajik" },
                        { value: "tk",    label: "Turkmen" },
                        { value: "tt",    label: "Tatar" },
                        // - Middle East & Africa -
                        { value: "he",    label: "Hebrew" },
                        { value: "ku",    label: "Kurdish" },
                        { value: "am",    label: "Amharic" },
                        { value: "so",    label: "Somali" },
                        { value: "ha",    label: "Hausa" },
                        { value: "yo",    label: "Yoruba" },
                        { value: "ig",    label: "Igbo" },
                        { value: "xh",    label: "Xhosa" },
                        { value: "zu",    label: "Zulu" },
                        // - Pacific & Other -
                        { value: "mi",    label: "Māori" },
                        { value: "ht",    label: "Haitian Creole" },
                      ]}
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">By default the assistant replies in whatever language the visitor writes in. Force a single language here if you need consistent transcripts.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Custom CSS</label>
                    <textarea
                      rows={4}
                      value={customCss}
                      onChange={(e) => handleInputChange(setCustomCss, e.target.value)}
                      placeholder=".chat-input-bar { border-radius: 4px; }"
                      spellCheck={false}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">Injected into the widget iframe. Advanced - invalid CSS is ignored by the browser, won&apos;t break the widget.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Custom JavaScript</label>
                    <textarea
                      rows={4}
                      value={customJs}
                      onChange={(e) => handleInputChange(setCustomJs, e.target.value)}
                      placeholder="console.log('Chatty widget loaded');"
                      spellCheck={false}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 sm:py-2 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 leading-normal">Runs once inside the widget iframe after it loads. Advanced - a script error here only affects the widget, not your site.</p>
                  </div>
                </div>

                {/* SECTION 2: CONNECTIONS */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Link2 className="size-4 text-[#f97316]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Connections &amp; Integrations</h3>
                    </div>
                    <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                      3-Tier Architecture
                    </span>
                  </div>

                  {/* ============================================================== */}
                  {/* TIER 3: PERSONAL TEAMMATE CALENDARS (STRICTLY CALENDAR-ONLY) */}
                  {/* ============================================================== */}
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                            <CalendarCheck className="size-3.5 text-[#f97316]" />
                            Tier 3: Personal Teammate Calendars
                          </span>
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            🔒 Strictly Calendar-Only
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-1 leading-normal">
                          Teammates connect direct personal Google Calendar and Outlook Calendar for unified bookings. Strictly calendar permissions &mdash; <strong>no access to Gmail, OneDrive, Drive files, or mailbox</strong>.
                        </p>
                      </div>
                    </div>

                    {/* My Personal Calendar Card (Current Logged-in User) */}
                    {currentMember && (
                      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center text-xs font-bold">
                              {(currentMember.name || currentMember.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                  My Personal Calendar ({currentMember.name || currentMember.email})
                                </span>
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                                  {currentMember.role || myRole}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-400">{currentMember.email}</span>
                            </div>
                          </div>

                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-neutral-600 dark:text-neutral-300">
                            <input
                              type="checkbox"
                              checked={Boolean(currentMember.book_on_own_calendar ?? true)}
                              onChange={(e) => {
                                if (currentMember.id && !currentMember.is_owner) {
                                  void toggleMemberCalendarPreference(currentMember.id, e.target.checked);
                                }
                              }}
                              disabled={currentMember.is_owner}
                              className="rounded border-neutral-300 text-[#f97316] focus:ring-[#f97316]"
                            />
                            <span>Book meetings directly on my calendar</span>
                          </label>
                        </div>

                        {/* Direct 1-Click Connect Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Google Calendar Personal Connection */}
                          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <svg className="size-3.5 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Google Calendar</span>
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                {currentMember.google_connected || memberGoogleEmail[currentMember.id]
                                  ? `Synced: ${currentMember.google_email || memberGoogleEmail[currentMember.id] || "Connected"}`
                                  : "Calendar-only permissions"}
                              </p>
                            </div>
                            <div>
                              {currentMember.google_connected || memberGoogleEmail[currentMember.id] ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectTeammateCalendar(currentMember.id, "google")}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="Disconnect your Google Calendar"
                                >
                                  Disconnect
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConnectTeammateCalendar(currentMember.id, "google")}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                                  title="Connect your personal Google Calendar (Calendar-only, no Drive access)"
                                >
                                  <Link2 className="size-3" />
                                  <span>Connect</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Outlook Calendar Personal Connection */}
                          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <svg className="size-3.5 shrink-0" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Outlook Calendar</span>
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                                {currentMember.microsoft_connected || memberMicrosoftEmail[currentMember.id]
                                  ? `Synced: ${currentMember.microsoft_email || memberMicrosoftEmail[currentMember.id] || "Connected"}`
                                  : "Calendar-only permissions"}
                              </p>
                            </div>
                            <div>
                              {currentMember.microsoft_connected || memberMicrosoftEmail[currentMember.id] ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectTeammateCalendar(currentMember.id, "microsoft")}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="Disconnect your Outlook Calendar"
                                >
                                  Disconnect
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleConnectTeammateCalendar(currentMember.id, "microsoft")}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                                  title="Connect your personal Microsoft Outlook Calendar (Calendar-only, no OneDrive access)"
                                >
                                  <Link2 className="size-3" />
                                  <span>Connect</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Personal Zoom / Video Link Field */}
                        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="text-[11px] text-neutral-500">
                            <strong>Personal Meeting Link:</strong> Real video URL (Zoom PMI, Google Meet) for direct bookings with you.
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              placeholder="https://zoom.us/j/1234567890"
                              value={memberZoomLink[currentMember.id] ?? currentMember.zoom_meeting_link ?? ""}
                              onChange={(e) => setMemberZoomLink((p) => ({ ...p, [currentMember.id]: e.target.value }))}
                              className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 w-48 sm:w-56"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveMemberCalendar(currentMember.id)}
                              disabled={savingMemberCalendar === currentMember.id}
                              className="px-2.5 py-1 bg-[#f97316] text-white hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {savingMemberCalendar === currentMember.id ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ============================================================== */}
                  {/* TIERS 1 & 2: WORKSPACE & BOT ACCOUNTS (FULL SYNC & DRIVE RAG) */}
                  {/* ============================================================== */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between pb-1 border-b border-neutral-100 dark:border-neutral-800">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-[#f97316]" />
                          Workspace &amp; Dedicated Bot Accounts (Tiers 1 &amp; 2)
                        </h4>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          Managed by Workspace Owner/Admin. Provides assistant fallback booking and knowledge base document sync (Drive / OneDrive).
                        </p>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full shrink-0">
                        Workspace Level
                      </span>
                    </div>

                    {myRole !== "owner" && myRole !== "admin" && (
                      <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
                        <ShieldCheck className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>
                          Organization Drive &amp; default calendar accounts are managed by your workspace administrator. Your personal schedule syncs via the calendar card above.
                        </span>
                      </div>
                    )}

                    {/* Google Connection Card */}
                    {(() => {
                      const isDedicatedAccount = Boolean(googleConnectedAccountId);
                      const dedicatedAccount = googleConnectedAccountId
                        ? googleAccounts.find((a) => a.id === googleConnectedAccountId)
                        : null;
                      const isWorkspaceAccount = !isDedicatedAccount && Boolean(
                        googleConnected && (syncGoogleDrive || (calendarSchedulingEnabled && meetingProvider === "google_meet"))
                      );
                      const isGoogleActiveOnBot = isDedicatedAccount || isWorkspaceAccount;
                      const hasOtherAccounts = googleAccounts.length > 1;

                      return (
                        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold flex items-center gap-1.5">
                                  <svg className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                  Google Workspace
                                </span>
                                {isDedicatedAccount ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Dedicated Bot Account
                                  </span>
                                ) : isWorkspaceAccount ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    Workspace Account Active
                                  </span>
                                ) : googleConnected ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-500">
                                    Disconnected for this bot
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-500">
                                    Not connected
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-normal">
                                {isDedicatedAccount
                                  ? `This bot uses its own dedicated Google account (${dedicatedAccount?.email || dedicatedAccount?.label || "Custom Account"}) for appointments and Drive.`
                                  : isWorkspaceAccount
                                  ? `This bot uses the shared workspace account (${googleEmail || "Workspace Google"}) for appointments and Drive.`
                                  : googleConnected
                                  ? `This bot is isolated (Google sync is off). You can connect a new account specific to this bot or use the workspace account.`
                                  : "Connect a Google account to enable Google Calendar bookings, Meet links, and Drive document sync."}
                              </p>
                            </div>

                            {/* Main Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              {!googleConnected && !isDedicatedAccount ? (
                                <button
                                  type="button"
                                  onClick={() => handleConnectCloud("google", "primary", botId || undefined)}
                                  disabled={connectingProvider !== null}
                                  className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                                >
                                  {connectingProvider === "google" && <Loader2 className="size-3 animate-spin" />}
                                  Connect Google
                                </button>
                              ) : isGoogleActiveOnBot ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectCloud("google", botId || undefined)}
                                    className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                    title="Disconnect Google sync for this bot only"
                                  >
                                    Disconnect
                                  </button>
                                  {isDedicatedAccount ? (
                                    googleConnected && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleInputChange(setGoogleConnectedAccountId, null);
                                          handleInputChange(setCalendarSchedulingEnabled, true);
                                          handleInputChange(setGoogleCalendarId, "primary");
                                          handleMeetingProviderChange("google_meet");
                                          showToast("Switched to workspace default Google account", "success");
                                        }}
                                        className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded-lg text-xs font-medium cursor-pointer transition-colors text-neutral-700 dark:text-neutral-200"
                                        title="Switch this bot to use the shared workspace account"
                                      >
                                        Use Workspace Default
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleConnectCloud("google", "add", botId || undefined)}
                                      disabled={connectingProvider !== null}
                                      className="px-3 py-1.5 bg-[#f97316] text-white hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-opacity disabled:opacity-55 flex items-center gap-1.5"
                                      title="Connect a separate Google account specifically for this bot"
                                    >
                                      {connectingProvider === "google" && <Loader2 className="size-3 animate-spin" />}
                                      + Connect Dedicated
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConnectCloud("google", "add", botId || undefined)}
                                    disabled={connectingProvider !== null}
                                    className="px-3 py-1.5 bg-[#f97316] text-white hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-opacity disabled:opacity-55 flex items-center gap-1.5"
                                    title="Connect a new Google account specifically for this bot"
                                  >
                                    {connectingProvider === "google" && <Loader2 className="size-3 animate-spin" />}
                                    + Connect Dedicated
                                  </button>
                                  {googleConnected && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleInputChange(setGoogleConnectedAccountId, null);
                                        handleInputChange(setCalendarSchedulingEnabled, true);
                                        handleInputChange(setGoogleCalendarId, "primary");
                                        handleMeetingProviderChange("google_meet");
                                        showToast("Google Calendar enabled for this bot (workspace account)", "success");
                                      }}
                                      className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-850 rounded-lg text-xs font-medium cursor-pointer transition-colors text-neutral-700 dark:text-neutral-200"
                                      title="Enable Google Calendar booking for this bot using workspace account"
                                    >
                                      Use Workspace Default
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Quick Switch Dropdown if multiple accounts exist */}
                          {hasOtherAccounts && (
                            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-2">
                              <span>Assigned Account:</span>
                              <select
                                value={googleConnectedAccountId || (isWorkspaceAccount ? "primary" : "none")}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "none") {
                                    handleDisconnectCloud("google", botId || undefined);
                                  } else if (val === "primary") {
                                    handleInputChange(setGoogleConnectedAccountId, null);
                                    handleInputChange(setCalendarSchedulingEnabled, true);
                                    handleInputChange(setGoogleCalendarId, "primary");
                                    handleMeetingProviderChange("google_meet");
                                    showToast("Switched to workspace default Google account", "success");
                                  } else if (val === "connect_new") {
                                    handleConnectCloud("google", "add", botId || undefined);
                                  } else {
                                    handleInputChange(setGoogleConnectedAccountId, val);
                                    handleInputChange(setCalendarSchedulingEnabled, true);
                                    handleInputChange(setGoogleCalendarId, "primary");
                                    handleMeetingProviderChange("google_meet");
                                    showToast("Switched to dedicated Google account", "success");
                                  }
                                }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                              >
                                <option value="none">Isolated (No sync)</option>
                                {googleConnected && (
                                  <option value="primary">Workspace Default ({googleEmail || "Google"})</option>
                                )}
                                {googleAccounts
                                  .filter((a) => a.id !== null)
                                  .map((a) => (
                                    <option key={a.id!} value={a.id!}>
                                      Dedicated: {a.label || a.email}
                                    </option>
                                  ))}
                                <option value="connect_new">+ Connect Dedicated Account...</option>
                              </select>
                            </div>
                          )}

                          {/* Workspace Shared Account Footnote */}
                          {googleConnected && (
                            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex flex-wrap items-center justify-between text-[10px] text-neutral-400 gap-2">
                              <span>
                                Workspace Account: <strong className="text-neutral-600 dark:text-neutral-300 font-medium">{googleEmail || "Connected"}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDisconnectCloud("google")}
                                className="text-red-500 hover:text-red-650 hover:underline cursor-pointer"
                                title="Disconnect Google OAuth account across all bots in your workspace"
                              >
                                Unlink Workspace
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Microsoft Connection Card */}
                    {(() => {
                      const isMicrosoftActiveOnBot = Boolean(syncOutlookCalendar || (calendarSchedulingEnabled && meetingProvider === "microsoft_teams"));
                      return (
                        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold flex items-center gap-1.5">
                                  <svg className="size-3.5" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                                  Microsoft 365
                                </span>
                                {microsoftConnected ? (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                                    isMicrosoftActiveOnBot
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                                  }`}>
                                    {isMicrosoftActiveOnBot ? "Active on this bot" : "Disconnected for this bot"}
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-500">
                                    Not connected
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                                {!microsoftConnected
                                  ? "Connect Microsoft 365 for Teams meetings, Outlook Calendar, and OneDrive sync."
                                  : isMicrosoftActiveOnBot
                                  ? `This bot uses ${microsoftEmail || "workspace Microsoft account"} for Teams and Outlook.`
                                  : `This bot is isolated (Microsoft sync is off). Workspace account ${microsoftEmail || ""} remains linked for other bots.`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!microsoftConnected ? (
                                <button
                                  type="button"
                                  onClick={() => handleConnectCloud("microsoft")}
                                  disabled={connectingProvider !== null}
                                  className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                                >
                                  {connectingProvider === "microsoft" && <Loader2 className="size-3 animate-spin" />}
                                  Connect Microsoft
                                </button>
                              ) : isMicrosoftActiveOnBot ? (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectCloud("microsoft", botId || undefined)}
                                  className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                  title="Turn off Microsoft Outlook/Teams sync for this bot only"
                                >
                                  Disconnect
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleInputChange(setCalendarSchedulingEnabled, true);
                                    handleInputChange(setSyncOutlookCalendar, true);
                                    handleMeetingProviderChange("microsoft_teams");
                                    showToast("Microsoft 365 enabled for this bot", "success");
                                  }}
                                  className="px-3 py-1.5 bg-[#f97316] text-white hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-opacity"
                                  title="Enable Microsoft Teams & Outlook Calendar for this bot"
                                >
                                  Use Workspace Default
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Workspace Shared Account Footnote */}
                          {microsoftConnected && (
                            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 flex flex-wrap items-center justify-between text-[10px] text-neutral-400 gap-2">
                              <span>
                                Workspace Account: <strong className="text-neutral-600 dark:text-neutral-300 font-medium">{microsoftEmail || "Connected"}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDisconnectCloud("microsoft")}
                                className="text-red-500 hover:text-red-650 hover:underline cursor-pointer"
                                title="Disconnect Microsoft OAuth account across all bots in your workspace"
                              >
                                Unlink Workspace
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Zoom Status Card */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <svg className="size-3.5" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#2D8CFF"/><path d="M6 9.5c0-.55.45-1 1-1h6c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-5zm9 1.2 2.6-1.7c.3-.2.7 0 .7.4v5.2c0 .4-.4.6-.7.4L15 14.3v-3.6z" fill="#fff"/></svg>
                          Zoom Meetings
                        </span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {zoomConfigured ? "Ready - bookings create real Zoom links automatically." : "Zoom is not configured on the server yet."}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${zoomConfigured ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"}`}>
                        {zoomConfigured ? "Ready" : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: DOCUMENT SYNC */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <FolderOpen className="size-4 text-[#f97316]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Document Sync (RAG)</h3>
                  </div>

                  {googleConnected || microsoftConnected ? (
                    <div className="space-y-4">
                      {googleConnected && (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold">Sync Google Drive (RAG)</span>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Allow bot to reference files from your Google Drive.</p>
                          </div>
                          <button
                            onClick={() => handleInputChange(setSyncGoogleDrive, !syncGoogleDrive)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                              syncGoogleDrive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                            }`}
                          >
                            <div className={`size-4 rounded-full bg-white transition-transform ${syncGoogleDrive ? "translate-x-4" : ""}`} />
                          </button>
                        </div>
                      )}

                      {microsoftConnected && (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold">Use Outlook Calendar for Teams bookings</span>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Turn on so the assistant books on Outlook/Teams instead of Google.</p>
                          </div>
                          <button
                            onClick={() => handleInputChange(setSyncOutlookCalendar, !syncOutlookCalendar)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${syncOutlookCalendar ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}
                          >
                            <div className={`size-4 rounded-full bg-white transition-transform ${syncOutlookCalendar ? "translate-x-4" : ""}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/60 rounded-xl p-3 text-center leading-relaxed">
                      Connect your Google Workspace or Microsoft 365 account to enable knowledge base document synchronization.
                    </div>
                  )}
                </div>

                {/* SECTION 4: CALENDAR SCHEDULING & BOOKING RULES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-[#f97316]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Calendar Scheduling</h3>
                    </div>
                    <button
                      onClick={() => handleInputChange(setCalendarSchedulingEnabled, !calendarSchedulingEnabled)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        calendarSchedulingEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${calendarSchedulingEnabled ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  {calendarSchedulingEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4 pt-1"
                    >
                      {/* Meeting Provider */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Meeting Provider</label>
                        <ModernSelect
                          value={meetingProvider}
                          options={providerOptions}
                          onChange={handleMeetingProviderChange}
                        />
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                          {meetingProvider === "google_meet"
                            ? "Real Meet links are generated automatically on the connected Google Calendar."
                            : meetingProvider === "zoom"
                            ? "Real Zoom links require Zoom credentials configured on the backend (else a placeholder is used)."
                            : "Real Microsoft Teams links are generated on booking - requires the owner to connect Microsoft/Outlook."}
                        </p>
                      </div>

                      {/* Calendar Connection & Data Isolation */}
                      {meetingProvider === "google_meet" && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                              Calendar Connection & Data Isolation
                            </label>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                              {googleConnectedAccountId ? "Dedicated Account" : "Default / Isolated"}
                            </span>
                          </div>
                          <ModernSelect
                            value={
                              !googleConnected && !googleConnectedAccountId
                                ? "none"
                                : googleConnectedAccountId
                                ? googleConnectedAccountId
                                : "primary"
                            }
                            options={[
                              { value: "none", label: "Isolated (No calendar sharing)" },
                              ...(googleConnected
                                ? [
                                    {
                                      value: "primary",
                                      label: `Workspace Primary (${googleAccounts.find((a) => a.id === null)?.email || "Google"})`,
                                    },
                                  ]
                                : []),
                              ...googleAccounts
                                .filter((a) => a.id !== null)
                                .map((a) => ({
                                  value: a.id || "",
                                  label: `Dedicated: ${a.label}`,
                                })),
                              ...otherBots.map((b) => ({
                                value: `bot:${b.id}`,
                                label: `Use same calendar as ${b.name}`,
                              })),
                              { value: "connect_new", label: "Connect new Google account..." },
                            ]}
                            onChange={async (v) => {
                              if (v === "none") {
                                handleInputChange(setGoogleConnectedAccountId, null);
                                handleInputChange(setGoogleCalendarId, "");
                                handleInputChange(setGoogleCalendarName, "");
                                showToast("Bot calendar set to isolated (no external calendar sync)", "info");
                              } else if (v === "connect_new") {
                                handleConnectCloud("google");
                              } else if (v === "primary") {
                                handleInputChange(setGoogleConnectedAccountId, null);
                                handleInputChange(setGoogleCalendarId, "primary");
                                handleInputChange(setGoogleCalendarName, "Primary Calendar");
                                showToast("Bound to workspace default Google account", "success");
                              } else if (v.startsWith("bot:")) {
                                const srcBotId = v.replace("bot:", "");
                                try {
                                  const res = await fetchWithFallback("/api/integrations/calendar/sync-from-bot", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ source_bot_id: srcBotId, target_bot_id: botId }),
                                  });
                                  if (res.ok) {
                                    const d = await res.json();
                                    handleInputChange(setGoogleConnectedAccountId, d.google_connected_account_id);
                                    handleInputChange(setGoogleCalendarId, d.google_calendar_id || "primary");
                                    handleInputChange(setGoogleCalendarName, d.google_calendar_name || "Synced Calendar");
                                    showToast("Synced calendar settings from bot!", "success");
                                    loadCalendars();
                                  } else {
                                    showToast("Failed to sync calendar from bot", "error");
                                  }
                                } catch {
                                  showToast("Error syncing calendar from bot", "error");
                                }
                              } else {
                                handleInputChange(setGoogleConnectedAccountId, v);
                                showToast("Dedicated Google account selected", "success");
                              }
                            }}
                          />
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                            New bots never share calendar slots or events by default. Pick an exclusive account, workspace default, or sync with another bot.
                          </p>
                        </div>
                      )}

                      {/* Target Calendar (Multi-calendar isolation) */}
                      {meetingProvider === "google_meet" && googleConnected && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">Target Calendar</label>
                            <button
                              type="button"
                              onClick={loadCalendars}
                              disabled={loadingCalendars}
                              className="text-xs text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className={`size-3 ${loadingCalendars ? "animate-spin" : ""}`} />
                              Refresh
                            </button>
                          </div>
                          <ModernSelect
                            value={googleCalendarId || "primary"}
                            options={
                              googleCalendars.length > 0
                                ? googleCalendars.map((c) => ({
                                    value: c.id,
                                    label: `${c.summary}${c.primary ? " (Primary)" : ""}`,
                                  }))
                                : [{ value: "primary", label: "Primary Calendar" }]
                            }
                            onChange={(v) => {
                              const matched = googleCalendars.find((c) => c.id === v);
                              handleInputChange(setGoogleCalendarId, v);
                              handleInputChange(setGoogleCalendarName, matched?.summary || "");
                            }}
                          />
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                            Appointments and availability checks for this bot will be strictly scoped to this calendar.
                          </p>
                        </div>
                      )}

                      {/* Google Calendar Event Color */}
                      {meetingProvider === "google_meet" && googleConnected && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                            Google Calendar Event Colors
                          </label>
                          <ModernSelect
                            value={googleCalendarColor || "auto_multiple"}
                            options={[
                              { value: "auto_multiple", label: "Multi-Color Palette (Dynamic per visitor & topic)" },
                              { value: "7", label: "Peacock (Cyan / Turquoise) - Demos" },
                              { value: "3", label: "Grape (Royal Purple) - VIP & Strategy" },
                              { value: "10", label: "Basil (Forest Green) - Sales & Quotes" },
                              { value: "6", label: "Tangerine (Vivid Orange) - Tech Support" },
                              { value: "9", label: "Blueberry (Royal Blue) - Onboarding" },
                              { value: "2", label: "Sage (Soft Green) - Discovery" },
                              { value: "4", label: "Flamingo (Coral / Rose) - Reviews" },
                              { value: "5", label: "Banana (Yellow) - Rescheduled" },
                              { value: "1", label: "Lavender (Pale Blue) - General" },
                              { value: "11", label: "Tomato (Crimson Red) - Urgent" },
                              { value: "8", label: "Graphite (Neutral Gray)" },
                            ]}
                            onChange={(v) => {
                              if (setGoogleCalendarColor) {
                                handleInputChange(setGoogleCalendarColor, v);
                              }
                            }}
                          />
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                            {googleCalendarColor === "auto_multiple" || !googleCalendarColor
                              ? "Chatty uses multiple distinct colors across your Google Calendar so different bookings and topics are easily distinguishable."
                              : "New appointments created by this bot will be tagged with this Google Calendar color chip."}
                          </p>
                        </div>
                      )}

                      {/* Dedicated Zoom Meeting Link / PMI */}
                      {meetingProvider === "zoom" && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                            Dedicated Zoom Meeting Link or PMI (Optional)
                          </label>
                          <input
                            type="url"
                            value={customMeetingLink}
                            onChange={(e) => {
                              if (setCustomMeetingLink) {
                                handleInputChange(setCustomMeetingLink, e.target.value);
                              }
                            }}
                            placeholder="https://zoom.us/j/1234567890 or your personal meeting room"
                            className="w-full text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 sm:py-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#f97316]"
                          />
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5 leading-normal">
                            When configured, this bot uses this dedicated Zoom link for booked appointments so calls don&apos;t mix across bots.
                          </p>
                        </div>
                      )}

                      {/* Duration Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Allowed Time Duration</label>
                        <ModernSelect
                          value={String(schedulingDuration)}
                          options={[15, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} Minutes` }))}
                          onChange={(v) => handleInputChange(setSchedulingDuration, parseInt(v, 10))}
                        />
                      </div>

                      {/* Country + Timezone (auto-detected, searchable) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">{t("country")}</label>
                          <ModernSelect
                            value={botCountry}
                            options={countryOptions}
                            onChange={(v) => handleInputChange(setBotCountry, v)}
                            searchable
                            placeholder="Select country"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">{t("timezone")}</label>
                          <ModernSelect
                            value={botTimezone}
                            options={timezoneOptions}
                            onChange={(v) => handleInputChange(setBotTimezone, v)}
                            searchable
                            placeholder="Select timezone"
                          />
                        </div>
                      </div>

                      {/* ── Booking Rules ── */}
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 space-y-3.5">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-[#f97316]" /> Booking Rules
                        </h5>

                        {/* Business hours */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Open From</label>
                            <ModernSelect
                              value={String(businessHoursStart)}
                              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                              onChange={(v) => handleInputChange(setBusinessHoursStart, parseInt(v, 10))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Open Until</label>
                            <ModernSelect
                              value={String(businessHoursEnd)}
                              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                              onChange={(v) => handleInputChange(setBusinessHoursEnd, parseInt(v, 10))}
                            />
                          </div>
                        </div>

                        {/* Working days */}
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Working Days</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
                              { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" }, { id: "sun", label: "Sun" },
                            ].map((d) => {
                              const on = workingDays.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  onClick={() => handleInputChange(setWorkingDays, on ? workingDays.filter((x) => x !== d.id) : [...workingDays, d.id])}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                    on ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]" : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Buffer + advance notice */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Buffer Between Meetings</label>
                            <ModernSelect
                              value={String(bufferMinutes)}
                              options={[0, 5, 10, 15, 30].map((m) => ({ value: String(m), label: m === 0 ? "No buffer" : `${m} min` }))}
                              onChange={(v) => handleInputChange(setBufferMinutes, parseInt(v, 10))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Minimum Advance Notice</label>
                            <ModernSelect
                              value={String(advanceNoticeHours)}
                              options={[0, 1, 2, 4, 12, 24, 48].map((h) => ({ value: String(h), label: h === 0 ? "None" : `${h} hours` }))}
                              onChange={(v) => handleInputChange(setAdvanceNoticeHours, parseInt(v, 10))}
                            />
                          </div>
                        </div>

                        {/* Daily + weekly booking quotas */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Max Meetings Per Day</label>
                            <ModernSelect
                              value={String(maxDailyMeetings)}
                              options={[
                                { value: "0", label: "No limit (unlimited)" },
                                { value: "1", label: "1 per day" },
                                { value: "2", label: "2 per day" },
                                { value: "3", label: "3 per day" },
                                { value: "4", label: "4 per day" },
                                { value: "5", label: "5 per day" },
                                { value: "6", label: "6 per day" },
                                { value: "8", label: "8 per day" },
                              ]}
                              onChange={(v) => handleInputChange(setMaxDailyMeetings, parseInt(v, 10))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Max Meetings Per Week</label>
                            <ModernSelect
                              value={String(maxWeeklyMeetings)}
                              options={[
                                { value: "0", label: "No limit (unlimited)" },
                                { value: "5", label: "5 per week" },
                                { value: "10", label: "10 per week" },
                                { value: "15", label: "15 per week" },
                                { value: "20", label: "20 per week" },
                                { value: "25", label: "25 per week" },
                                { value: "30", label: "30 per week" },
                              ]}
                              onChange={(v) => handleInputChange(setMaxWeeklyMeetings, parseInt(v, 10))}
                            />
                          </div>
                        </div>

                        {/* ── Abuse & Spam Protection (4 Defenses) ── */}
                        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-450 flex items-center gap-1.5">
                              <ShieldAlert className="size-3.5 text-[#f97316]" /> Abuse &amp; Spam Protection
                            </h5>
                            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                              Optional Defenses
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-normal">
                            Prevent bots and malicious actors from flooding your calendar or reserving fake appointments.
                          </p>

                          <div className="space-y-2.5">
                            {/* Defense 1: Email OTP Verification */}
                            <div className="flex items-start sm:items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 gap-3">
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Email OTP Verification</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">Strongest</span>
                                </div>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-normal">
                                  Sends a 6-digit one-time passcode to the attendee&apos;s email before confirming the booking.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingEmailVerification, !bookingEmailVerification)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                                  bookingEmailVerification ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingEmailVerification ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 2: Block Disposable Email Providers */}
                            <div className="flex items-start sm:items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 gap-3">
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Block Disposable Emails</span>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-normal">
                                  Rejects throwaway / burner inbox domains (e.g. mailinator, tempmail, guerrillamail).
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingBlockDisposableEmails, !bookingBlockDisposableEmails)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                                  bookingBlockDisposableEmails ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingBlockDisposableEmails ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 3: Limit 1 Active Booking Per Email */}
                            <div className="flex items-start sm:items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 gap-3">
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Limit 1 Active Booking Per Email</span>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-normal">
                                  Prevents a single email address from hoarding multiple concurrent future bookings.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingLimitOneActive, !bookingLimitOneActive)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                                  bookingLimitOneActive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingLimitOneActive ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 4: Require Business / Work Email */}
                            <div className="flex items-start sm:items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 gap-3">
                              <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Require Business Email</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-medium">B2B</span>
                                </div>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-normal">
                                  Rejects consumer inboxes (@gmail, @yahoo, @outlook, etc.) and requires a corporate domain.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingRequireBusinessEmail, !bookingRequireBusinessEmail)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                                  bookingRequireBusinessEmail ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingRequireBusinessEmail ? "translate-x-4" : ""}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Read-only summary of ALL active rules */}
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3 space-y-1 leading-relaxed">
                          <p className="font-bold text-neutral-600 dark:text-neutral-300 uppercase text-[9px] tracking-wider mb-1">All active booking rules</p>
                          <p>• Hours: <b>{(businessHoursStart % 12) || 12}:00 {businessHoursStart < 12 ? "AM" : "PM"}</b> - <b>{(businessHoursEnd % 12) || 12}:00 {businessHoursEnd < 12 ? "AM" : "PM"}</b> ({botTimezone})</p>
                          <p>• Days: <b>{workingDays.length ? workingDays.map((d) => d.toUpperCase()).join(", ") : "None set"}</b></p>
                          <p>• Duration: <b>{schedulingDuration} min</b>{bufferMinutes ? <> · Buffer: <b>{bufferMinutes} min</b></> : null}</p>
                          {advanceNoticeHours ? <p>• Advance notice: <b>{advanceNoticeHours} hours</b></p> : null}
                          {maxDailyMeetings ? <p>• Daily limit: <b>Max {maxDailyMeetings} meetings/day</b></p> : null}
                          {maxWeeklyMeetings ? <p>• Weekly limit: <b>Max {maxWeeklyMeetings} meetings/week</b></p> : null}
                          {bookingEmailVerification ? <p>• Security: <b>Email OTP verification required</b></p> : null}
                          {bookingBlockDisposableEmails ? <p>• Security: <b>Disposable email addresses blocked</b></p> : null}
                          {bookingLimitOneActive ? <p>• Security: <b>Max 1 active booking per attendee email</b></p> : null}
                          {bookingRequireBusinessEmail ? <p>• Security: <b>Business/corporate email required</b></p> : null}
                          <p>• Platform: <b>{meetingProvider.replace("_", " ")}</b></p>
                          <p>• Collects all lead fields (<b>{leadFields.join(", ")}</b>) + visitor timezone before booking</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

              </div>
            </div>
  );
}
