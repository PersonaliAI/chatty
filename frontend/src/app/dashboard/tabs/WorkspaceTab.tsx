"use client";

import React, { useState } from "react";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  Crown,
  History,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlink,
  User,
  Users,
  Video,
} from "lucide-react";
import type { TeamMember, AdminAuditLog } from "../dashboard-types";
import {
  MemberAvailabilityEditor,
  MemberOooEditor,
  MemberPermissionEditor,
  TeamTabCheckbox,
} from "../dashboard-controls";
import {
  CHATTY_TEAM_TABS,
  OWNER_ONLY_TABS,
  ROLE_DEFAULT_TABS,
  ROLE_INFO,
  TAB_LABELS,
  toggleTabIntelligently,
  type ChattyTeamTab,
  type ChattyTeamRole,
} from "../dashboard-permissions";
import { ModernSelect } from "@/components/ui/modern-select";

export interface WorkspaceTabProps {
  myRole: string | null;
  botId: string | null;
  allBots?: { id: string; name: string }[];
  user?: { id?: string; email?: string | null; name?: string | null } | null;
  teamMembers: TeamMember[];
  teamOwner?: TeamMember | null;
  googleConnected: boolean;
  googleEmail: string | null;
  microsoftConnected: boolean;
  microsoftEmail: string | null;
  zoomConfigured: boolean;
  connectingProvider: string | null;
  handleConnectCloud: (provider: "google" | "microsoft") => void;
  handleDisconnectCloud: (provider: "google" | "microsoft" | "zoom", targetBotId?: string) => void;
  inviteName: string;
  setInviteName: (v: string) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: ChattyTeamRole;
  setInviteRole: (r: ChattyTeamRole) => void;
  inviteTabs: ChattyTeamTab[];
  setInviteTabs: React.Dispatch<React.SetStateAction<ChattyTeamTab[]>>;
  invitingTeam: boolean;
  inviteTeamMember: () => Promise<void> | void;
  updateTeamMember: (id: string, role: string, permissions: ChattyTeamTab[]) => Promise<void> | void;
  removeTeamMember: (id: string) => Promise<void> | void;
  reloadTeam?: () => Promise<void> | void;
  adminAuditLogs?: AdminAuditLog[];
  loadingAdminData?: boolean;
  loadAdminData?: (id: string) => Promise<void>;
  formatDateTime?: (dt: string) => string;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  fetchWithFallback: (path: string, options?: RequestInit) => Promise<Response>;
}

export function WorkspaceTab({
  myRole,
  botId,
  allBots = [],
  user,
  teamMembers,
  teamOwner,
  googleConnected,
  googleEmail,
  microsoftConnected,
  microsoftEmail,
  zoomConfigured,
  connectingProvider,
  handleConnectCloud,
  handleDisconnectCloud,
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
  updateTeamMember,
  removeTeamMember,
  reloadTeam,
  adminAuditLogs = [],
  loadingAdminData = false,
  loadAdminData,
  formatDateTime = (dt) => new Date(dt).toLocaleString(),
  showToast,
  fetchWithFallback,
}: WorkspaceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"connections" | "team" | "audit">("connections");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [editingOooId, setEditingOooId] = useState<string | null>(null);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [memberGoogleEmail, setMemberGoogleEmail] = useState<Record<string, string>>({});
  const [memberMicrosoftEmail, setMemberMicrosoftEmail] = useState<Record<string, string>>({});
  const [memberZoomLink, setMemberZoomLink] = useState<Record<string, string>>({});
  const [savingMemberCalendar, setSavingMemberCalendar] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState("");

  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin" || !myRole;
  const grantableTabs = isOwnerOrAdmin && myRole === "admin"
    ? CHATTY_TEAM_TABS.filter((t) => !OWNER_ONLY_TABS.has(t))
    : CHATTY_TEAM_TABS;

  const handleSaveMemberCalendar = async (memberId: string) => {
    if (!botId) return;
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
          google_email: gEmail || null,
          microsoft_email: msEmail || null,
          zoom_meeting_link: zoom || null,
        }),
      });
      if (res.ok) {
        showToast("Calendar links saved.", "success");
        setEditingCalendarId(null);
        void reloadTeam?.();
      } else {
        showToast("Failed to save calendar links.", "error");
      }
    } catch {
      showToast("Error updating calendar links.", "error");
    } finally {
      setSavingMemberCalendar(null);
    }
  };

  const handleConnectTeammateCalendar = async (memberId: string, provider: "google" | "microsoft") => {
    try {
      const res = await fetchWithFallback(`/api/integrations/${provider}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          scope_type: "calendar",
          member_id: memberId,
          redirect_path: "/dashboard?tab=workspace",
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
    if (!botId) return;
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

  const filteredAuditLogs = auditFilter.trim()
    ? adminAuditLogs.filter(
        (log) =>
          (log.action || "").toLowerCase().includes(auditFilter.toLowerCase()) ||
          (log.details || "").toLowerCase().includes(auditFilter.toLowerCase()) ||
          (log.performed_by || "").toLowerCase().includes(auditFilter.toLowerCase())
      )
    : adminAuditLogs;

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      {/* Top Workspace Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-50 via-white to-neutral-100 dark:from-neutral-900 dark:via-neutral-925 dark:to-neutral-950 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center shrink-0 border border-[#f97316]/20">
            <Building2 className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Workspace Settings & Integrations</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <Crown className="size-2.5" /> Workspace Hub
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Manage organization-wide OAuth connections, team permissions, and workspace defaults.
            </p>
          </div>
        </div>

        {/* Quick Workspace Stats */}
        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">Assistants</span>
            <span className="block text-xs font-bold text-neutral-800 dark:text-neutral-200">{allBots.length || 1}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">Team Roster</span>
            <span className="block text-xs font-bold text-neutral-800 dark:text-neutral-200">{teamMembers.length + (teamOwner ? 1 : 0)}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-center">
            <span className="block text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">Integrations</span>
            <span className="block text-xs font-bold text-[#f97316]">
              {(googleConnected ? 1 : 0) + (microsoftConnected ? 1 : 0) + (zoomConfigured ? 1 : 0)} / 3 Active
            </span>
          </div>
        </div>
      </div>

      {/* Modern Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setActiveSubTab("connections")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "connections"
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <Link2 className="size-3.5 text-[#f97316]" />
          <span>Workspace Connections</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("team");
            void reloadTeam?.();
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "team"
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <Users className="size-3.5 text-[#f97316]" />
          <span>Team Collaboration &amp; Roles</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSubTab("audit");
            if (botId && loadAdminData) void loadAdminData(botId);
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === "audit"
              ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
          }`}
        >
          <History className="size-3.5 text-[#f97316]" />
          <span>Organization Audit Trail</span>
        </button>
      </div>

      {/* SUB-TAB 1: WORKSPACE CONNECTIONS (STANDARDIZED 3-TIER: WORKSPACE TIER) */}
      {activeSubTab === "connections" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-blue-600 dark:text-blue-400" />
                Default Workspace Integrations (Tier 1)
              </span>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                These workspace credentials serve as organizational defaults. Each assistant can inherit them or configure its own separate account.
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full shrink-0">
              Admin &amp; Owner Managed
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {/* Google Workspace Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-2 shrink-0 border border-neutral-200/80 dark:border-neutral-750 flex items-center justify-center">
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Google Workspace</h3>
                    {googleConnected ? (
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <Check className="size-2.5" /> Connected
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {googleConnected
                      ? `Connected as ${googleEmail || "Workspace Primary"}. Syncs Google Calendar, Meet, and Drive.`
                      : "Connect primary Google Workspace for video meetings, calendar slots, and cloud documents."}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] text-neutral-400">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Calendar</span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Google Meet</span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Google Drive</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                {googleConnected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnectCloud("google")}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Disconnect Google account from workspace"
                  >
                    <Unlink className="size-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnectCloud("google")}
                    disabled={connectingProvider !== null}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {connectingProvider === "google" ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    <span>Connect Google</span>
                  </button>
                )}
              </div>
            </div>

            {/* Microsoft 365 Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-2 shrink-0 border border-neutral-200/80 dark:border-neutral-750 flex items-center justify-center">
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path fill="#F25022" d="M3 3h8v8H3z" />
                    <path fill="#7FBA00" d="M13 3h8v8h-8z" />
                    <path fill="#00A4EF" d="M3 13h8v8H3z" />
                    <path fill="#FFB900" d="M13 13h8v8h-8z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Microsoft 365</h3>
                    {microsoftConnected ? (
                      <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <Check className="size-2.5" /> Connected
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {microsoftConnected
                      ? `Connected as ${microsoftEmail || "Workspace Account"}. Generates Teams meetings and syncs Outlook Calendar.`
                      : "Connect Microsoft 365 tenant for Outlook calendar appointments, Teams video links, and OneDrive."}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] text-neutral-400">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Outlook Calendar</span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Microsoft Teams</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                {microsoftConnected ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnectCloud("microsoft")}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Disconnect Microsoft account from workspace"
                  >
                    <Unlink className="size-3.5" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnectCloud("microsoft")}
                    disabled={connectingProvider !== null}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {connectingProvider === "microsoft" ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    <span>Connect Microsoft</span>
                  </button>
                )}
              </div>
            </div>

            {/* Zoom Video Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-[#2D8CFF]/10 text-[#2D8CFF] p-2 shrink-0 border border-[#2D8CFF]/20 flex items-center justify-center">
                  <Video className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Zoom Video Communications</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      zoomConfigured
                        ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}>
                      {zoomConfigured ? "Configured" : "Available"}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {zoomConfigured
                      ? "Server-side Zoom credentials active. Generates dynamic video conference links for guest bookings."
                      : "Assistants and team members can specify dedicated Zoom meeting links or personal meeting rooms."}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] text-neutral-400">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Direct Video</span>
                    <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">Personal Meeting ID (PMI)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                <span className="text-[11px] text-neutral-400 font-medium">
                  {zoomConfigured ? "Ready for all bots" : "Supported via bot links"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TEAM COLLABORATION & ACCESS CONTROL */}
      {activeSubTab === "team" && (
        <div className="space-y-5">
          {/* Invite Teammate Card */}
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Invite Team Member</h3>
                <p className="text-[11px] text-neutral-400">Add colleagues with predefined roles and tailored permissions.</p>
              </div>
              <span className="text-[10px] font-bold text-[#f97316] bg-[#f97316]/10 px-2 py-0.5 rounded-full">
                6 Standardized Roles
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Full Name (e.g. Sarah Connor)"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#f97316]"
              />
              <input
                type="email"
                placeholder="Work Email (e.g. sarah@acme.com)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-[#f97316]"
              />
              <ModernSelect
                size="sm"
                value={inviteRole}
                options={(["admin", "agent", "editor", "billing_manager", "viewer"] as ChattyTeamRole[]).map((r) => ({
                  value: r,
                  label: ROLE_INFO[r].label,
                  hint: ROLE_INFO[r].description,
                }))}
                onChange={(val) => {
                  const role = val as ChattyTeamRole;
                  setInviteRole(role);
                  setInviteTabs(ROLE_DEFAULT_TABS[role] || []);
                }}
              />
            </div>

            {/* Permissions Checkbox Grid for Invite */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <span className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Accessible Tabs &amp; Features for this Invite
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {grantableTabs.map((t) => (
                  <TeamTabCheckbox
                    key={t}
                    checked={inviteTabs.includes(t)}
                    onChange={(checked) => setInviteTabs((prev) => toggleTabIntelligently(prev, t, checked, grantableTabs))}
                    label={TAB_LABELS[t] || t}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={inviteTeamMember}
                disabled={invitingTeam || !inviteEmail.includes("@") || !inviteName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#f97316] hover:opacity-90 disabled:opacity-40 rounded-lg transition-opacity flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {invitingTeam ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                <span>Send Invitation</span>
              </button>
            </div>
          </div>

          {/* Members Roster */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Active Organization Collaborators ({teamMembers.length + (teamOwner ? 1 : 0)})
              </h3>
              {reloadTeam && (
                <button
                  type="button"
                  onClick={() => void reloadTeam()}
                  className="text-[10px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="size-3" />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {/* Owner Row */}
            {teamOwner && (
              <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                    {(teamOwner.name || teamOwner.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{teamOwner.name || teamOwner.email}</span>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <Crown className="size-2.5" /> Primary Owner
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400">{teamOwner.email}</span>
                  </div>
                </div>
                <span className="text-[10px] text-neutral-400 font-medium">Unrestricted Authority</span>
              </div>
            )}

            {/* Team Members List */}
            {teamMembers.map((m) => {
              const isEditing = editingMemberId === m.id;
              const isEditingAvailability = editingAvailabilityId === m.id;
              const isEditingCalendar = editingCalendarId === m.id;
              const isEditingOoo = editingOooId === m.id;
              const roleInfo = ROLE_INFO[m.role as ChattyTeamRole] || ROLE_INFO.agent;
              const memberTabs = ((m.permissions && m.permissions.length > 0
                ? m.permissions
                : ROLE_DEFAULT_TABS[m.role as ChattyTeamRole] || [])) as ChattyTeamTab[];

              return (
                <div key={m.id} className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                        {(m.name || m.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{m.name || m.email}</span>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${roleInfo.badgeClasses}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                        {m.name && <span className="text-[10px] text-neutral-400">{m.email}</span>}
                      </div>
                    </div>

                    {/* Action Buttons with Crisp Short Labels */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingCalendar) {
                            setEditingCalendarId(null);
                          } else {
                            setMemberGoogleEmail((p) => ({ ...p, [m.id]: p[m.id] ?? (m.google_email || "") }));
                            setMemberMicrosoftEmail((p) => ({ ...p, [m.id]: p[m.id] ?? (m.microsoft_email || "") }));
                            setMemberZoomLink((p) => ({ ...p, [m.id]: p[m.id] ?? (m.zoom_meeting_link || "") }));
                            setEditingCalendarId(m.id);
                          }
                        }}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          isEditingCalendar
                            ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {isEditingCalendar ? "Close" : "Calendar Links"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingAvailabilityId(isEditingAvailability ? null : m.id)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          isEditingAvailability
                            ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {isEditingAvailability ? "Close" : "Working Hours"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingOooId(isEditingOoo ? null : m.id)}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          isEditingOoo
                            ? "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300"
                            : m.ooo_active
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/60"
                            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {isEditingOoo ? "Close" : m.ooo_active ? "🌴 Away" : "Vacation"}
                      </button>

                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(isEditing ? null : m.id)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                            isEditing
                              ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                              : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          }`}
                        >
                          {isEditing ? "Close" : "Permissions"}
                        </button>
                      )}

                      {isOwnerOrAdmin && !m.is_owner && (
                        <button
                          type="button"
                          onClick={() => removeTeamMember(m.id)}
                          className="text-[10px] font-semibold px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer"
                          title="Remove teammate from workspace"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {m.google_connected && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-medium">
                        <Check className="size-2.5" /> Google ({m.google_email || "Linked"})
                      </span>
                    )}
                    {m.microsoft_connected && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-medium">
                        <Check className="size-2.5" /> MS ({m.microsoft_email || "Linked"})
                      </span>
                    )}
                    {m.zoom_meeting_link && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-medium">
                        <Video className="size-2.5" /> Zoom Linked
                      </span>
                    )}
                    {m.ooo_active && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        🌴 Out of Office {m.ooo_backup_email ? `(Backup: ${m.ooo_backup_email})` : ""}
                      </span>
                    )}
                  </div>

                  {/* Calendar / Video Modal Inline (Tier 3 Calendar-Only) */}
                  {isEditingCalendar && (
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
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
                        <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
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
                                  value={memberGoogleEmail[m.id] ?? ""}
                                  onChange={(e) => setMemberGoogleEmail((p) => ({ ...p, [m.id]: e.target.value }))}
                                  className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Microsoft Outlook Card */}
                        <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-2">
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
                                  value={memberMicrosoftEmail[m.id] ?? ""}
                                  onChange={(e) => setMemberMicrosoftEmail((p) => ({ ...p, [m.id]: e.target.value }))}
                                  className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Personal Zoom Room */}
                      <div className="p-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 space-y-1.5">
                        <label className="block text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <Video className="size-3.5 text-blue-500" /> Personal Zoom Meeting Room (PMI Link)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="url"
                            placeholder="https://zoom.us/j/1234567890"
                            value={memberZoomLink[m.id] ?? ""}
                            onChange={(e) => setMemberZoomLink((p) => ({ ...p, [m.id]: e.target.value }))}
                            className="flex-1 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5"
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

                  {/* Editors */}
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

                  {isEditingAvailability && botId && (
                    <MemberAvailabilityEditor
                      memberId={m.id}
                      botId={botId}
                      showToast={showToast}
                      fetchWithFallback={fetchWithFallback}
                    />
                  )}

                  {isEditingOoo && botId && (
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ORGANIZATION AUDIT TRAIL */}
      {activeSubTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Organization Audit Trail</h3>
              <p className="text-[11px] text-neutral-400">Chronological history of security, team, and integration events.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search audit events…"
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-xs"
              />
              {botId && loadAdminData && (
                <button
                  type="button"
                  onClick={() => void loadAdminData(botId)}
                  className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  title="Refresh audit log"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            {loadingAdminData ? (
              <div className="p-8 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading audit records…</span>
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No audit events recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto [scrollbar-width:thin]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-950/50 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase font-bold text-neutral-400">
                    <tr>
                      <th className="px-3.5 py-2.5">Timestamp</th>
                      <th className="px-3.5 py-2.5">Action</th>
                      <th className="px-3.5 py-2.5">Details</th>
                      <th className="px-3.5 py-2.5">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                    {filteredAuditLogs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30">
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[11px] text-neutral-400 font-mono">
                          {log.created_at ? formatDateTime(log.created_at) : "-"}
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold text-neutral-800 dark:text-neutral-200">
                          {log.action}
                        </td>
                        <td className="px-3.5 py-2.5 text-neutral-600 dark:text-neutral-300">
                          {log.details || "-"}
                        </td>
                        <td className="px-3.5 py-2.5 text-neutral-400 whitespace-nowrap text-[11px]">
                          {log.performed_by || "System"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
