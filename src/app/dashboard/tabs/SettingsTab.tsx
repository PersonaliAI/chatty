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
} from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import {
  MemberAvailabilityEditor,
  MemberPermissionEditor,
  TeamTabCheckbox,
} from "../dashboard-controls";
import {
  CHATTY_TEAM_TABS,
  DEFAULT_ADMIN_TABS,
  DEFAULT_AGENT_TABS,
  OWNER_ONLY_TABS,
  TAB_LABELS,
  type ChattyTeamTab,
} from "../dashboard-permissions";
import type { TeamMember } from "../dashboard-types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface SettingsTabProps {
  canAccessTab: (tab: ChattyTeamTab | null) => boolean;
  myRole: string;
  inviteName: string;
  setInviteName: (n: string) => void;
  inviteEmail: string;
  setInviteEmail: (e: string) => void;
  inviteRole: "agent" | "admin";
  setInviteRole: (r: "agent" | "admin") => void;
  inviteTabs: ChattyTeamTab[];
  setInviteTabs: React.Dispatch<React.SetStateAction<ChattyTeamTab[]>>;
  invitingTeam: boolean;
  inviteTeamMember: () => Promise<void> | void;
  teamMembers: TeamMember[];
  editingMemberId: string | null;
  setEditingMemberId: (id: string | null) => void;
  editingAvailabilityId: string | null;
  setEditingAvailabilityId: (id: string | null) => void;
  toggleMemberBookable: (id: string, bookable: boolean) => Promise<void> | void;
  toggleMemberCalendarPreference: (id: string, bookOnOwnCalendar: boolean) => Promise<void> | void;
  updateTeamMember: (id: string, role: "agent" | "admin", permissions: ChattyTeamTab[]) => Promise<void> | void;
  removeTeamMember: (id: string) => Promise<void> | void;
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
  microsoftConnected: boolean;
  zoomConfigured: boolean;
  connectingProvider: "google" | "microsoft" | null;
  handleConnectCloud: (provider: "google" | "microsoft") => Promise<void> | void;
  handleDisconnectCloud: (provider: "google" | "microsoft") => Promise<void> | void;
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
  fetchWithFallback: (url: string, init?: RequestInit) => Promise<Response>;
  t: (key: string) => string;
}

export function SettingsTab({
  user,
  botId,
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
  teamMembers,
  editingMemberId,
  setEditingMemberId,
  editingAvailabilityId,
  setEditingAvailabilityId,
  toggleMemberBookable,
  toggleMemberCalendarPreference,
  updateTeamMember,
  removeTeamMember,
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
  microsoftConnected,
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
    if (!googleConnected) return;
    let mounted = true;
    fetchWithFallback("/api/integrations/google/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        const list: Array<{ id: string | null; label: string; email: string }> = [];
        if (data.primary_account) {
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
  }, [googleConnected, fetchWithFallback]);

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

  React.useEffect(() => {
    loadCalendars();
  }, [loadCalendars]);

  return (
            <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
              <div className="w-full max-w-2xl p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-8">

                {/* SECTION 0: TEAM */}
                {canAccessTab("team") && (() => {
                  // What THIS caller may grant to someone else - an admin
                  // managing the roster can hand out any tab except the
                  // owner-only ones (billing/BYOK/webhooks), matching the
                  // backend's OWNER_ONLY_TABS enforcement.
                  const grantableTabs = CHATTY_TEAM_TABS.filter((t) => myRole === "owner" || !OWNER_ONLY_TABS.has(t));
                  return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                      <Users className="size-4 text-[#f97316]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Team</h3>
                    </div>
                    <p className="text-[11px] text-neutral-400 -mt-2">
                      Invite teammates to help manage this bot. We&apos;ll email them, but this doesn&apos;t create an
                      account for them - they need their own: if they don&apos;t have one yet, they sign up at
                      chatty.personaliai.com with the exact email below, and this bot appears in their dashboard
                      automatically. Access is limited to this bot only, and to the tabs checked below - pick which
                      dashboard sections they can reach.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Full name"
                        className="sm:w-40 shrink-0 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <input
                        type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                        className="flex-1 min-w-0 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-28 shrink-0">
                          <ModernSelect
                            value={inviteRole}
                            options={[{ value: "agent", label: "Agent" }, { value: "admin", label: "Admin" }]}
                            onChange={(v) => {
                              const role = v as "agent" | "admin";
                              setInviteRole(role);
                              setInviteTabs((role === "admin" ? DEFAULT_ADMIN_TABS : DEFAULT_AGENT_TABS)
                                .filter((t) => grantableTabs.includes(t)) as ChattyTeamTab[]);
                            }}
                          />
                        </div>
                        <button onClick={inviteTeamMember} disabled={invitingTeam || !inviteEmail.includes("@") || !inviteName.trim()}
                          className="flex-1 sm:flex-initial px-3.5 py-2 text-[11px] font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap">
                          {invitingTeam ? "Inviting…" : "Invite"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {grantableTabs.map((tab) => (
                        <TeamTabCheckbox
                          key={tab}
                          checked={inviteTabs.includes(tab)}
                          onChange={(checked) => setInviteTabs((p) => checked ? [...p, tab] : p.filter((t) => t !== tab))}
                          label={TAB_LABELS[tab]}
                        />
                      ))}
                    </div>
                    {teamMembers.length > 0 && (
                      <div className="space-y-1.5">
                        {teamMembers.map((m) => {
                          const memberTabs = (m.permissions || []) as ChattyTeamTab[];
                          const isEditing = editingMemberId === m.id;
                          const isEditingAvailability = editingAvailabilityId === m.id;
                          const isSelf = !!user?.email && user.email.toLowerCase() === m.email.toLowerCase();
                          const canManageAvailability = canAccessTab("team") || isSelf;
                          return (
                            <div key={m.id} className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-neutral-700 dark:text-neutral-200 truncate">{m.name || m.email}</span>
                                  {m.name && <span className="text-[10px] text-neutral-400 truncate">{m.email}</span>}
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-500">{m.role}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {canManageAvailability && (
                                    <button onClick={() => setEditingAvailabilityId(isEditingAvailability ? null : m.id)} className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                                      {isEditingAvailability ? "Close" : "Availability"}
                                    </button>
                                  )}
                                  <button onClick={() => setEditingMemberId(isEditing ? null : m.id)} className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors">
                                    {isEditing ? "Close" : "Manage"}
                                  </button>
                                  <button onClick={() => removeTeamMember(m.id)} className="text-[10px] font-medium text-neutral-400 hover:text-red-500 transition-colors">Remove</button>
                                </div>
                              </div>
                              {!isEditing && memberTabs.length > 0 && (
                                <p className="text-[10px] text-neutral-400 truncate">{memberTabs.map((t) => TAB_LABELS[t] || t).join(", ")}</p>
                              )}
                              {canAccessTab("team") && (
                                <div className="space-y-1.5">
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
                                        label={m.book_on_own_calendar !== false ? "Books on their own calendar" : "Books on your (admin) calendar instead"}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                              {isEditing && (
                                <MemberPermissionEditor
                                  role={m.role === "admin" ? "admin" : "agent"}
                                  permissions={memberTabs}
                                  grantableTabs={grantableTabs}
                                  onSave={(role, permissions) => updateTeamMember(m.id, role, permissions)}
                                  onCancel={() => setEditingMemberId(null)}
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">AI Foundation Model</label>
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
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">Selected model handles logic & responses inside your widget.</p>
                  </div>

                  {/* Knowledge Source */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Knowledge Source</label>
                    <ModernSelect
                      value={answerMode}
                      onChange={(v) => handleInputChange(setAnswerMode, v as "strict" | "hybrid" | "web")}
                      options={[
                        { value: "strict", label: "Knowledge base only", hint: "Safest - answers strictly from your trained sources" },
                        { value: "hybrid", label: "Knowledge base + AI knowledge", hint: "Falls back to the model's general knowledge" },
                        { value: "web", label: "Knowledge base + web search", hint: "Looks up live info on the web when needed" },
                      ]}
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
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
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Bring Your Own Key (BYOK)</span>
                          {byokConfigured && byokProvider === expected?.provider && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                              <Check className="size-2.5" /> Configured
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                          This model runs on your own {expected?.label.replace(" API key", "")} key - Chatty doesn&apos;t supply one. Note: lead capture and meeting booking tools currently only work on Gemini; BYOK models still answer from your knowledge base.
                        </p>
                        <input
                          type="password"
                          value={byokApiKeyInput}
                          onChange={(e) => setByokApiKeyInput(e.target.value)}
                          placeholder={byokConfigured ? "•••••••••••••••• (saved - enter a new key to replace)" : expected?.placeholder}
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <input
                          type="text"
                          value={byokModel}
                          onChange={(e) => setByokModel(e.target.value)}
                          placeholder="Model override (optional, e.g. gpt-4o-mini)"
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setByokProvider(expected!.provider); handleSaveByok(false); }}
                            disabled={savingByok || !byokApiKeyInput.trim()}
                            className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                          >
                            {savingByok ? "Saving…" : "Save key"}
                          </button>
                          {byokConfigured && (
                            <button
                              onClick={() => handleSaveByok(true)}
                              disabled={savingByok}
                              className="px-3 py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">System Instructions / Guardrails</label>
                      <button
                        onClick={generateInstructions}
                        disabled={isGeneratingInstructions}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-[#ea6b0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Configures behavior limitations and answers guidelines.</p>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Knowledge Base Strict Mode</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Only answer questions using verified trained memory sources.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setStrictMode, !strictMode)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          strictMode ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${strictMode ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Email Lead Alerts</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Receive instant email updates when visitors submit contact info.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setEmailNotify, !emailNotify)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          emailNotify ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${emailNotify ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Remove &quot;Powered by Chatty&quot; Branding</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Hide the Chatty footer mark in the widget (white-label).</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setHideBranding, !hideBranding)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          hideBranding ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${hideBranding ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Show AI / Human Tag</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Label each reply in the widget as &quot;AI&quot; or &quot;Human agent&quot;.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setShowSenderTag, !showSenderTag)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          showSenderTag ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${showSenderTag ? "translate-x-4" : ""}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold">Post-Chat Rating Prompt</span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Ask visitors to rate the conversation when they close the widget.</p>
                      </div>
                      <button
                        onClick={() => handleInputChange(setCsatEnabled, !csatEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                          csatEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div className={`size-4 rounded-full bg-white transition-transform ${csatEnabled ? "translate-x-4" : ""}`} />
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
                      className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-[#ea6b0e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Auto-generate from trained knowledge (same generator as System Instructions above)"
                    >
                      {isGeneratingInstructions
                        ? <Loader2 className="size-3 animate-spin" />
                        : <Sparkles className="size-3" />}
                      {isGeneratingInstructions ? "Generating…" : "Auto-generate"}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Off-Topic Refusal</label>
                    <textarea
                      rows={2}
                      value={guardrailTopics}
                      onChange={(e) => handleInputChange(setGuardrailTopics, e.target.value)}
                      placeholder="e.g. politics, medical advice, legal advice, competitor products"
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Comma-separated topics the assistant should always decline to discuss. Leave empty to allow any on-topic discussion.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Custom Refusal Message</label>
                    <input
                      type="text"
                      value={guardrailRefusalMessage}
                      onChange={(e) => handleInputChange(setGuardrailRefusalMessage, e.target.value)}
                      placeholder="Sorry, I can't help with that - but I'm happy to answer questions about our product!"
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">Block Profanity & Abuse</span>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Refuse to engage with abusive or profane visitor messages.</p>
                    </div>
                    <button
                      onClick={() => handleInputChange(setGuardrailBlockProfanity, !guardrailBlockProfanity)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                        guardrailBlockProfanity ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                      }`}
                    >
                      <div className={`size-4 rounded-full bg-white transition-transform ${guardrailBlockProfanity ? "translate-x-4" : ""}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Response Language</label>
                    <ModernSelect
                      value={responseLanguage}
                      onChange={(v) => handleInputChange(setResponseLanguage, v)}
                      options={[
                        { value: "", label: "🌐 Mirror visitor's language (default)" },
                        // - Most common -
                        { value: "en",    label: "🇬🇧 English" },
                        { value: "es",    label: "🇪🇸 Spanish" },
                        { value: "es-MX", label: "🇲🇽 Spanish (Mexico)" },
                        { value: "zh",    label: "🇨🇳 Chinese (Simplified)" },
                        { value: "zh-TW", label: "🇹🇼 Chinese (Traditional)" },
                        { value: "hi",    label: "🇮🇳 Hindi" },
                        { value: "ar",    label: "🇸🇦 Arabic" },
                        { value: "pt",    label: "🇵🇹 Portuguese" },
                        { value: "pt-BR", label: "🇧🇷 Portuguese (Brazil)" },
                        { value: "fr",    label: "🇫🇷 French" },
                        { value: "ru",    label: "🇷🇺 Russian" },
                        { value: "de",    label: "🇩🇪 German" },
                        { value: "ja",    label: "🇯🇵 Japanese" },
                        { value: "ko",    label: "🇰🇷 Korean" },
                        { value: "it",    label: "🇮🇹 Italian" },
                        { value: "tr",    label: "🇹🇷 Turkish" },
                        { value: "vi",    label: "🇻🇳 Vietnamese" },
                        { value: "pl",    label: "🇵🇱 Polish" },
                        { value: "nl",    label: "🇳🇱 Dutch" },
                        { value: "th",    label: "🇹🇭 Thai" },
                        { value: "id",    label: "🇮🇩 Indonesian" },
                        { value: "ms",    label: "🇲🇾 Malay" },
                        { value: "tl",    label: "🇵🇭 Filipino (Tagalog)" },
                        { value: "sv",    label: "🇸🇪 Swedish" },
                        { value: "uk",    label: "🇺🇦 Ukrainian" },
                        { value: "fa",    label: "🇮🇷 Persian (Farsi)" },
                        { value: "ur",    label: "🇵🇰 Urdu" },
                        { value: "bn",    label: "🇧🇩 Bengali" },
                        { value: "sw",    label: "🇰🇪 Swahili" },
                        { value: "ta",    label: "🇮🇳 Tamil" },
                        { value: "te",    label: "🇮🇳 Telugu" },
                        { value: "mr",    label: "🇮🇳 Marathi" },
                        { value: "gu",    label: "🇮🇳 Gujarati" },
                        { value: "kn",    label: "🇮🇳 Kannada" },
                        { value: "ml",    label: "🇮🇳 Malayalam" },
                        { value: "pa",    label: "🇮🇳 Punjabi" },
                        { value: "ne",    label: "🇳🇵 Nepali" },
                        { value: "si",    label: "🇱🇰 Sinhala" },
                        // - European -
                        { value: "da",    label: "🇩🇰 Danish" },
                        { value: "fi",    label: "🇫🇮 Finnish" },
                        { value: "no",    label: "🇳🇴 Norwegian" },
                        { value: "cs",    label: "🇨🇿 Czech" },
                        { value: "sk",    label: "🇸🇰 Slovak" },
                        { value: "ro",    label: "🇷🇴 Romanian" },
                        { value: "hu",    label: "🇭🇺 Hungarian" },
                        { value: "bg",    label: "🇧🇬 Bulgarian" },
                        { value: "hr",    label: "🇭🇷 Croatian" },
                        { value: "sr",    label: "🇷🇸 Serbian" },
                        { value: "bs",    label: "🇧🇦 Bosnian" },
                        { value: "sl",    label: "🇸🇮 Slovenian" },
                        { value: "mk",    label: "🇲🇰 Macedonian" },
                        { value: "sq",    label: "🇦🇱 Albanian" },
                        { value: "lt",    label: "🇱🇹 Lithuanian" },
                        { value: "lv",    label: "🇱🇻 Latvian" },
                        { value: "et",    label: "🇪🇪 Estonian" },
                        { value: "el",    label: "🇬🇷 Greek" },
                        { value: "ca",    label: "🏳️ Catalan" },
                        { value: "gl",    label: "🏳️ Galician" },
                        { value: "eu",    label: "🏳️ Basque" },
                        { value: "cy",    label: "🏴󠁧󠁢󠁷󠁬󠁳󠁿 Welsh" },
                        { value: "ga",    label: "🇮🇪 Irish" },
                        { value: "is",    label: "🇮🇸 Icelandic" },
                        { value: "mt",    label: "🇲🇹 Maltese" },
                        { value: "lb",    label: "🇱🇺 Luxembourgish" },
                        { value: "yi",    label: "🕍 Yiddish" },
                        // - Central & Eastern Asia -
                        { value: "mn",    label: "🇲🇳 Mongolian" },
                        { value: "my",    label: "🇲🇲 Burmese (Myanmar)" },
                        { value: "km",    label: "🇰🇭 Khmer" },
                        { value: "lo",    label: "🇱🇦 Lao" },
                        { value: "ka",    label: "🇬🇪 Georgian" },
                        { value: "hy",    label: "🇦🇲 Armenian" },
                        { value: "az",    label: "🇦🇿 Azerbaijani" },
                        { value: "kk",    label: "🇰🇿 Kazakh" },
                        { value: "ky",    label: "🇰🇬 Kyrgyz" },
                        { value: "uz",    label: "🇺🇿 Uzbek" },
                        { value: "tg",    label: "🇹🇯 Tajik" },
                        { value: "tk",    label: "🇹🇲 Turkmen" },
                        { value: "tt",    label: "🇷🇺 Tatar" },
                        // - Middle East & Africa -
                        { value: "he",    label: "🇮🇱 Hebrew" },
                        { value: "ku",    label: "🏳️ Kurdish" },
                        { value: "am",    label: "🇪🇹 Amharic" },
                        { value: "so",    label: "🇸🇴 Somali" },
                        { value: "ha",    label: "🇳🇬 Hausa" },
                        { value: "yo",    label: "🇳🇬 Yoruba" },
                        { value: "ig",    label: "🇳🇬 Igbo" },
                        { value: "xh",    label: "🇿🇦 Xhosa" },
                        { value: "zu",    label: "🇿🇦 Zulu" },
                        // - Pacific & Other -
                        { value: "mi",    label: "🇳🇿 Māori" },
                        { value: "ht",    label: "🇭🇹 Haitian Creole" },
                      ]}
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">By default the assistant replies in whatever language the visitor writes in. Force a single language here if you need consistent transcripts.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Custom CSS</label>
                    <textarea
                      rows={4}
                      value={customCss}
                      onChange={(e) => handleInputChange(setCustomCss, e.target.value)}
                      placeholder=".chat-input-bar { border-radius: 4px; }"
                      spellCheck={false}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Injected into the widget iframe. Advanced - invalid CSS is ignored by the browser, won&apos;t break the widget.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Custom JavaScript</label>
                    <textarea
                      rows={4}
                      value={customJs}
                      onChange={(e) => handleInputChange(setCustomJs, e.target.value)}
                      placeholder="console.log('Chatty widget loaded');"
                      spellCheck={false}
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-[11px] font-mono text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none leading-relaxed"
                    />
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Runs once inside the widget iframe after it loads. Advanced - a script error here only affects the widget, not your site.</p>
                  </div>
                </div>

                {/* SECTION 2: CONNECTIONS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <Link2 className="size-4 text-[#f97316]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Connections & Integrations</h3>
                  </div>

                  <div className="space-y-3">
                    {/* Google Connection Card */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <svg className="size-3.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Google Workspace Account
                        </span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {googleConnected ? "Connected successfully." : "Not connected yet."}
                        </p>
                      </div>
                      {googleConnected ? (
                        <button
                          onClick={() => handleDisconnectCloud("google")}
                          className="px-3 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectCloud("google")}
                          disabled={connectingProvider !== null}
                          className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                        >
                          {connectingProvider === "google" && <Loader2 className="size-3 animate-spin" />}
                          Connect
                        </button>
                      )}
                    </div>

                    {/* Microsoft Connection Card */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div>
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <svg className="size-3.5" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                          Microsoft 365 Account
                        </span>
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {microsoftConnected ? "Connected - enables Teams, Outlook Calendar & OneDrive." : "Connect for Teams meetings, Outlook calendar & OneDrive."}
                        </p>
                      </div>
                      {microsoftConnected ? (
                        <button
                          onClick={() => handleDisconnectCloud("microsoft")}
                          className="px-3 py-1.5 bg-red-50 text-red-650 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectCloud("microsoft")}
                          disabled={connectingProvider !== null}
                          className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-55 flex items-center gap-1.5"
                        >
                          {connectingProvider === "microsoft" && <Loader2 className="size-3 animate-spin" />}
                          Connect
                        </button>
                      )}
                    </div>

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
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Meeting Provider</label>
                        <ModernSelect
                          value={meetingProvider}
                          options={providerOptions}
                          onChange={handleMeetingProviderChange}
                        />
                        <p className="text-[9px] text-neutral-400 mt-1">
                          {meetingProvider === "google_meet"
                            ? "Real Meet links are generated automatically on the connected Google Calendar."
                            : meetingProvider === "zoom"
                            ? "Real Zoom links require Zoom credentials configured on the backend (else a placeholder is used)."
                            : "Real Microsoft Teams links are generated on booking - requires the owner to connect Microsoft/Outlook."}
                        </p>
                      </div>

                      {/* Connected Google Account (Multi-account isolation) */}
                      {meetingProvider === "google_meet" && googleConnected && googleAccounts.length > 1 && (
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Google Account</label>
                          <ModernSelect
                            value={googleConnectedAccountId || ""}
                            options={googleAccounts.map((a) => ({
                              value: a.id || "",
                              label: a.label,
                            }))}
                            onChange={(v) => handleInputChange(setGoogleConnectedAccountId, v || null)}
                          />
                          <p className="text-[9px] text-neutral-400 mt-1">
                            Bind this bot to a dedicated Google account instead of the workspace default.
                          </p>
                        </div>
                      )}

                      {/* Target Calendar (Multi-calendar isolation) */}
                      {meetingProvider === "google_meet" && googleConnected && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase">Target Calendar</label>
                            <button
                              type="button"
                              onClick={loadCalendars}
                              disabled={loadingCalendars}
                              className="text-[10px] text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className={`size-2.5 ${loadingCalendars ? "animate-spin" : ""}`} />
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
                          <p className="text-[9px] text-neutral-400 mt-1">
                            Appointments and availability checks for this bot will be strictly scoped to this calendar.
                          </p>
                        </div>
                      )}

                      {/* Duration Selector */}
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Allowed Time Duration</label>
                        <ModernSelect
                          value={String(schedulingDuration)}
                          options={[15, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} Minutes` }))}
                          onChange={(v) => handleInputChange(setSchedulingDuration, parseInt(v, 10))}
                        />
                      </div>

                      {/* Country + Timezone (auto-detected, searchable) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">{t("country")}</label>
                          <ModernSelect
                            value={botCountry}
                            options={countryOptions}
                            onChange={(v) => handleInputChange(setBotCountry, v)}
                            searchable
                            placeholder="Select country"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">{t("timezone")}</label>
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
                      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-850 space-y-3">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-450 flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-[#f97316]" /> Booking Rules
                        </h5>

                        {/* Business hours */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-505 uppercase mb-1">Open From</label>
                            <ModernSelect
                              value={String(businessHoursStart)}
                              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                              onChange={(v) => handleInputChange(setBusinessHoursStart, parseInt(v, 10))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-505 uppercase mb-1">Open Until</label>
                            <ModernSelect
                              value={String(businessHoursEnd)}
                              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${(h % 12) || 12}:00 ${h < 12 ? "AM" : "PM"}` }))}
                              onChange={(v) => handleInputChange(setBusinessHoursEnd, parseInt(v, 10))}
                            />
                          </div>
                        </div>

                        {/* Working days */}
                        <div>
                          <label className="block text-[10px] font-semibold text-neutral-505 uppercase mb-1">Working Days</label>
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
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
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
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Buffer Between Meetings</label>
                            <ModernSelect
                              value={String(bufferMinutes)}
                              options={[0, 5, 10, 15, 30].map((m) => ({ value: String(m), label: m === 0 ? "No buffer" : `${m} min` }))}
                              onChange={(v) => handleInputChange(setBufferMinutes, parseInt(v, 10))}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Minimum Advance Notice</label>
                            <ModernSelect
                              value={String(advanceNoticeHours)}
                              options={[0, 1, 2, 4, 12, 24, 48].map((h) => ({ value: String(h), label: h === 0 ? "None" : `${h} hours` }))}
                              onChange={(v) => handleInputChange(setAdvanceNoticeHours, parseInt(v, 10))}
                            />
                          </div>
                        </div>

                        {/* Daily + weekly booking quotas */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Meetings Per Day</label>
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
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Meetings Per Week</label>
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
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-normal">
                            Prevent bots and malicious actors from flooding your calendar or reserving fake appointments.
                          </p>

                          <div className="space-y-2.5">
                            {/* Defense 1: Email OTP Verification */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50">
                              <div className="space-y-0.5 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Email OTP Verification</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">Strongest</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                  Sends a 6-digit one-time passcode to the attendee&apos;s email before confirming the booking.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingEmailVerification, !bookingEmailVerification)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                                  bookingEmailVerification ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingEmailVerification ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 2: Block Disposable Email Providers */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50">
                              <div className="space-y-0.5 pr-2">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Block Disposable Emails</span>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                  Rejects throwaway / burner inbox domains (e.g. mailinator, tempmail, guerrillamail).
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingBlockDisposableEmails, !bookingBlockDisposableEmails)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                                  bookingBlockDisposableEmails ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingBlockDisposableEmails ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 3: Limit 1 Active Booking Per Email */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50">
                              <div className="space-y-0.5 pr-2">
                                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Limit 1 Active Booking Per Email</span>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                  Prevents a single email address from hoarding multiple concurrent future bookings.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingLimitOneActive, !bookingLimitOneActive)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                                  bookingLimitOneActive ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
                                }`}
                              >
                                <div className={`size-4 rounded-full bg-white transition-transform ${bookingLimitOneActive ? "translate-x-4" : ""}`} />
                              </button>
                            </div>

                            {/* Defense 4: Require Business / Work Email */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50">
                              <div className="space-y-0.5 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Require Business Email</span>
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-medium">B2B</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                  Rejects consumer inboxes (@gmail, @yahoo, @outlook, etc.) and requires a corporate domain.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleInputChange(setBookingRequireBusinessEmail, !bookingRequireBusinessEmail)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
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
