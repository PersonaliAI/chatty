"use client";

import React from "react";
import Image from "next/image";
import {
  Database,
  RefreshCw,
  FileText,
  Globe,
  FileUp,
  FolderOpen,
  HardDrive,
  Sparkles,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Link2,
  Trash2,
  Search,
  Layers,
  Calendar,
  Type,
  ShoppingBag,
} from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import { KBManager } from "@/components/kb-manager";
import { ProductsMediaCatalog } from "@/components/products-media-catalog";
import { CloudProviderMenu } from "../dashboard-controls";
import { KnowledgeProgressBar, type KnowledgeProgress } from "../knowledge-progress-bar";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Source } from "../dashboard-types";

export interface KnowledgeTabProps {
  botId: string;
  fetchWithFallback: (url: string, init?: RequestInit) => Promise<Response>;
  primaryColor: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleKnowledgeUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void;
  user: SupabaseUser | null;
  loadBotSettings: (userId: string) => Promise<void> | void;
  loadingLists: boolean;
  savingLeadCapture: boolean;
  setSavingLeadCapture: (v: boolean) => void;
  leadCaptureEnabled: boolean;
  setLeadCaptureEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  leadFields: string[];
  setLeadFields: React.Dispatch<React.SetStateAction<string[]>>;
  leadRequiredFields: string[];
  setLeadRequiredFields: React.Dispatch<React.SetStateAction<string[]>>;
  newLeadField: string;
  setNewLeadField: (v: string) => void;
  onboardingStep: number | null | undefined;
  onboardingCompleted: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveOnboardingStep: (step: number, completed: boolean, extraData?: Record<string, any>) => Promise<void> | void;
  googleConnected: boolean;
  microsoftConnected: boolean;
  handleConnectCloud: (provider: "google" | "microsoft") => void | Promise<void>;
  handleDisconnectCloud: (provider: "google" | "microsoft") => void | Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleInputChange: (setter: (val: any) => void, val: any) => void;
  calendarSchedulingEnabled: boolean;
  setCalendarSchedulingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  handleCalendarSyncChange: (v: string) => void;
  meetingProvider: string;
  handleMeetingProviderChange: (v: string) => void;
  providerOptions: ModernSelectOption[];
  sources: Source[];
  knowledgeProgress: KnowledgeProgress | null;
  setKnowledgeProgress: React.Dispatch<React.SetStateAction<KnowledgeProgress | null>>;
  kbSourceTab: "text" | "url" | "file" | "drive" | "onedrive" | "products";
  setKbSourceTab: (tab: "text" | "url" | "file" | "drive" | "onedrive" | "products") => void;
  inputTitle: string;
  setInputTitle: (t: string) => void;
  inputText: string;
  setInputText: (t: string) => void;
  handleTrainText: (e: React.FormEvent) => void | Promise<void>;
  isKnowledgeLoading: boolean;
  inputUrl: string;
  setInputUrl: (u: string) => void;
  handleScanSitemap: () => void | Promise<void>;
  scanningSitemap: boolean;
  discoveredUrls: string[];
  selectedUrls: Set<string>;
  setSelectedUrls: React.Dispatch<React.SetStateAction<Set<string>>>;
  handleCrawlSelected: () => void | Promise<void>;
  handleBulkAddUrls: () => void | Promise<void>;
  handleTrainUrl: (e: React.FormEvent) => void | Promise<void>;
  bulkUrlsOpen: boolean;
  setBulkUrlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bulkUrlsText: string;
  setBulkUrlsText: (t: string) => void;
  uploadingFile: string | null;
  driveFolderUrl: string;
  setDriveFolderUrl: (u: string) => void;
  driveMaxFiles: number;
  setDriveMaxFiles: (n: number) => void;
  driveSyncSchedule: "off" | "daily" | "weekly" | "monthly";
  handleSetDriveSyncSchedule: (source: "gdrive" | "onedrive", schedule: "off" | "daily" | "weekly" | "monthly") => Promise<void> | void;
  onedriveSyncSchedule: "off" | "daily" | "weekly" | "monthly";
  handleIndexDriveFolder: (e: React.FormEvent, source?: "gdrive" | "onedrive") => Promise<void> | void;
  isIndexingDrive: boolean;
  driveIndexSuccess: string | null;
  driveIndexError: string | null;
  syncScheduleOptions: ModernSelectOption[];
  unanswered: Array<{ id: string; question: string; created_at: string }>;
  answeringId: string | null;
  setAnsweringId: (id: string | null) => void;
  answerText: string;
  setAnswerText: (t: string) => void;
  resolveUnanswered: (id: string, question: string) => Promise<void> | void;
  dismissUnanswered: (id: string) => void | Promise<void>;
  handleCrawlAll: () => void | Promise<void>;
  crawlingAll: boolean;
  crawlDropdownOpen: string | null;
  setCrawlDropdownOpen: React.Dispatch<React.SetStateAction<string | null>>;
  handleSetCrawlSchedule: (id: string, schedule: "off" | "daily" | "weekly" | "monthly") => Promise<void> | void;
  sourceTypeFilter: "all" | "text" | "url" | "file";
  setSourceTypeFilter: React.Dispatch<React.SetStateAction<"all" | "text" | "url" | "file">>;
  sourcesSearch: string;
  setSourcesSearch: (s: string) => void;
  expandedSourceId: string | null;
  setExpandedSourceId: (id: string | null) => void;
  recrawlingSourceId: string | null;
  handleRecrawlNow: (sourceId: string, url: string) => void | Promise<void>;
  handleDeleteSource: (sourceId: string) => void | Promise<void>;
  crawlingPages: boolean;
  crawlSummary: string | null;
  setActiveTab: (t: string) => void;
  t: (key: string) => string;
}

export function KnowledgeTab({
  handleInputChange,
  setCalendarSchedulingEnabled,
  setKnowledgeProgress,
  botId,
  fetchWithFallback,
  primaryColor,
  fileInputRef,
  handleKnowledgeUpload,
  user,
  loadBotSettings,
  loadingLists,
  savingLeadCapture,
  setSavingLeadCapture,
  leadCaptureEnabled,
  setLeadCaptureEnabled,
  leadFields,
  setLeadFields,
  leadRequiredFields,
  setLeadRequiredFields,
  newLeadField,
  setNewLeadField,
  onboardingStep,
  onboardingCompleted,
  saveOnboardingStep,
  googleConnected,
  microsoftConnected,
  handleConnectCloud,
  handleDisconnectCloud,
  calendarSchedulingEnabled,
  handleCalendarSyncChange,
  meetingProvider,
  handleMeetingProviderChange,
  providerOptions,
  sources,
  knowledgeProgress,
  kbSourceTab,
  setKbSourceTab,
  inputTitle,
  setInputTitle,
  inputText,
  setInputText,
  handleTrainText,
  isKnowledgeLoading,
  inputUrl,
  setInputUrl,
  handleScanSitemap,
  scanningSitemap,
  discoveredUrls,
  selectedUrls,
  setSelectedUrls,
  handleCrawlSelected,
  handleBulkAddUrls,
  handleTrainUrl,
  bulkUrlsOpen,
  setBulkUrlsOpen,
  bulkUrlsText,
  setBulkUrlsText,
  uploadingFile,
  driveFolderUrl,
  setDriveFolderUrl,
  driveMaxFiles,
  setDriveMaxFiles,
  driveSyncSchedule,
  handleSetDriveSyncSchedule,
  onedriveSyncSchedule,
  handleIndexDriveFolder,
  isIndexingDrive,
  driveIndexSuccess,
  driveIndexError,
  syncScheduleOptions,
  unanswered,
  answeringId,
  setAnsweringId,
  answerText,
  setAnswerText,
  resolveUnanswered,
  dismissUnanswered,
  handleCrawlAll,
  crawlingAll,
  crawlDropdownOpen,
  setCrawlDropdownOpen,
  handleSetCrawlSchedule,
  sourceTypeFilter,
  setSourceTypeFilter,
  sourcesSearch,
  setSourcesSearch,
  expandedSourceId,
  setExpandedSourceId,
  recrawlingSourceId,
  handleRecrawlNow,
  handleDeleteSource,
  crawlingPages,
  crawlSummary,
  setActiveTab,
  t,
}: KnowledgeTabProps) {
  return (
            <KBManager
              botId={botId}
              fetchBackend={fetchWithFallback}
              color={primaryColor}
              rawSourcesContent={
                <div className="space-y-6">
              {/* Hidden file input (re-uses existing upload handler) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleKnowledgeUpload}
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
              />

              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Database className="size-4 text-[#f97316]" />
                    {t("knowledge_base")}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                    Everything your assistant knows. Add text, crawl websites, upload documents, or sync a Google Drive folder - all sources are chunked and embedded into RAG memory.
                  </p>
                </div>
                <button
                  onClick={() => user && loadBotSettings(user.id)}
                  disabled={loadingLists}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${loadingLists ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {/* Lead Capture */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-2"><Database className="size-4 text-[#f97316]" />Lead Capture</h4>
                    <p className="text-[10px] text-neutral-400 mt-1 max-w-md">Collect visitor details in conversations. Required fields must be gathered; new fields create columns in the Leads table automatically.</p>
                  </div>
                  <button type="button" disabled={savingLeadCapture || !botId}
                    onClick={async () => {
                      const next = !leadCaptureEnabled;
                      setLeadCaptureEnabled(next);
                      if (!botId) return;
                      setSavingLeadCapture(true);
                      try {
                        await saveOnboardingStep(onboardingStep || 0, onboardingCompleted, { lead_fields: leadFields, lead_capture_enabled: next, lead_required_fields: leadRequiredFields });
                      } finally {
                        setSavingLeadCapture(false);
                      }
                    }}
                    aria-label="Toggle lead capture"
                    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${leadCaptureEnabled ? "bg-[#f97316]" : "bg-neutral-300 dark:bg-neutral-700"}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${leadCaptureEnabled ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>

                {leadCaptureEnabled && (
                  <>
                    <div className="space-y-2">
                      {leadFields.map((field) => {
                        const required = leadRequiredFields.map((f) => f.toLowerCase()).includes(field.toLowerCase());
                        return (
                          <div key={field} className="flex items-center justify-between gap-2 p-2 pl-3 rounded-lg border border-neutral-100 dark:border-neutral-800">
                            <span className="text-xs font-medium capitalize">{field.replace(/_/g, " ")}</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setLeadRequiredFields((prev) => required ? prev.filter((f) => f.toLowerCase() !== field.toLowerCase()) : [...prev, field])}
                                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer transition-colors ${required ? "bg-[#f97316]/10 text-[#f97316]" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"}`}>
                                {required ? "Required" : "Optional"}
                              </button>
                              <button type="button" onClick={() => { setLeadFields((prev) => prev.filter((f) => f !== field)); setLeadRequiredFields((prev) => prev.filter((f) => f.toLowerCase() !== field.toLowerCase())); }}
                                className="px-1.5 text-neutral-400 hover:text-red-500 text-xs cursor-pointer" aria-label="Remove field">✕</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input value={newLeadField} onChange={(e) => setNewLeadField(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const f = newLeadField.trim().toLowerCase().replace(/\s+/g, "_"); if (f && !leadFields.map((x) => x.toLowerCase()).includes(f)) setLeadFields((p) => [...p, f]); setNewLeadField(""); } }}
                        placeholder="Add a field (e.g. company, budget)"
                        className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
                      <button type="button" onClick={() => { const f = newLeadField.trim().toLowerCase().replace(/\s+/g, "_"); if (f && !leadFields.map((x) => x.toLowerCase()).includes(f)) setLeadFields((p) => [...p, f]); setNewLeadField(""); }}
                        className="px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer">+ Add</button>
                    </div>
                  </>
                )}

                <button type="button" disabled={savingLeadCapture || !botId}
                  onClick={async () => { if (!botId) return; setSavingLeadCapture(true); try { await saveOnboardingStep(onboardingStep || 0, onboardingCompleted, { lead_fields: leadFields, lead_capture_enabled: leadCaptureEnabled, lead_required_fields: leadRequiredFields }); } finally { setSavingLeadCapture(false); } }}
                  className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50">
                  {savingLeadCapture ? "Saving…" : "Save lead settings"}
                </button>
              </div>

              {/* Quick connect strip */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mr-1">Quick connect:</span>
                <CloudProviderMenu
                  label="Google"
                  iconSrc="/logos/google.png"
                  connected={googleConnected}
                  onDisconnect={() => handleDisconnectCloud("google")}
                  services={[
                    { label: "Google Drive", iconSrc: "/logos/google-drive.png", onClick: () => googleConnected ? setKbSourceTab("drive") : handleConnectCloud("google") },
                    { label: "Google Calendar", iconSrc: "/logos/google-calendar.png", onClick: () => handleCalendarSyncChange("google") },
                  ]}
                />
                <CloudProviderMenu
                  label="Microsoft"
                  iconSrc="/logos/microsoft.png"
                  connected={microsoftConnected}
                  onDisconnect={() => handleDisconnectCloud("microsoft")}
                  services={[
                    { label: "OneDrive", iconSrc: "/logos/onedrive.png", onClick: () => microsoftConnected ? setKbSourceTab("onedrive") : handleConnectCloud("microsoft") },
                    { label: "Outlook Calendar", iconSrc: "/logos/outlook-calendar.png", onClick: () => handleCalendarSyncChange("outlook") },
                  ]}
                />
                <button
                  onClick={() => setKbSourceTab("url")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Globe className="size-3.5" /> Website
                </button>
                <button
                  onClick={() => { setKbSourceTab("file"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <FileUp className="size-3.5" /> Upload
                </button>
              </div>

              {/* Scheduling quick-config */}
              <div className="flex flex-wrap items-center gap-4 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5"><Calendar className="size-3.5" /> Scheduling:</span>
                <button
                  onClick={() => handleInputChange(setCalendarSchedulingEnabled, !calendarSchedulingEnabled)}
                  className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer"
                >
                  <span className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${calendarSchedulingEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"}`}>
                    <span className={`block size-3.5 rounded-full bg-white transition-transform ${calendarSchedulingEnabled ? "translate-x-3.5" : ""}`} />
                  </span>
                  {calendarSchedulingEnabled ? "Booking on" : "Booking off"}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">Provider</span>
                  <div className="w-40"><ModernSelect value={meetingProvider} options={providerOptions} onChange={handleMeetingProviderChange} size="sm" /></div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400">Calendar</span>
                  <div className="w-44"><ModernSelect
                    value={meetingProvider === "teams" ? "outlook" : "google"}
                    options={[
                      { value: "google", label: "Google Calendar", icon: <Image src="/logos/google-calendar.png" alt="" width={16} height={16} className="size-4 object-contain" />, hint: googleConnected ? undefined : "connect Google" },
                      { value: "outlook", label: "Outlook Calendar", icon: <Image src="/logos/outlook-calendar.png" alt="" width={16} height={16} className="size-4 object-contain" />, hint: microsoftConnected ? undefined : "connect Microsoft" },
                    ]}
                    onChange={handleCalendarSyncChange}
                    size="sm"
                  /></div>
                </div>
                {!googleConnected && !microsoftConnected && calendarSchedulingEnabled && (
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="text-[10px] font-semibold text-[#f97316] hover:underline cursor-pointer"
                  >
                    Connect Google or Microsoft to actually sync bookings →
                  </button>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Total Sources</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.length}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500"><Layers className="size-5" /></div>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Characters Indexed</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.reduce((acc, s) => acc + (s.charCount || 0), 0).toLocaleString()}</h4>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500"><FileText className="size-5" /></div>
                </div>
                <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Status</span>
                    <h4 className="text-2xl font-bold mt-1">{sources.filter(s => s.status === "trained").length}<span className="text-sm font-medium text-neutral-400"> / {sources.length} trained</span></h4>
                    {sources.some(s => s.status === "training") && (
                      <span className="text-[9px] text-[#f97316] font-medium flex items-center gap-1 mt-1">
                        <Loader2 className="size-3 animate-spin" /> {sources.filter(s => s.status === "training").length} training…
                        {knowledgeProgress && knowledgeProgress.status === "active" && (
                          <span className="font-mono font-bold">({knowledgeProgress.percent}%)</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-500"><Check className="size-5" /></div>
                </div>
              </div>

              {/* Animated Knowledge Base Progress Bar Banner */}
              <KnowledgeProgressBar
                progress={knowledgeProgress}
                onDismiss={() => setKnowledgeProgress(null)}
              />

              {/* Add Source Card */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="p-1.5 border-b border-neutral-100 dark:border-neutral-800 flex gap-1 overflow-x-auto rounded-t-2xl">
                  {[
                    { id: "text", label: "Text / FAQ", icon: Type },
                    { id: "url", label: "Website URL", icon: Globe },
                    { id: "file", label: "Upload File", icon: FileUp },
                    { id: "drive", label: "Google Drive", icon: FolderOpen },
                    { id: "onedrive", label: "OneDrive", icon: HardDrive },
                    { id: "products", label: "Products & Media", icon: ShoppingBag },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setKbSourceTab(tab.id as "text" | "url" | "file" | "drive" | "onedrive" | "products")}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                          kbSourceTab === tab.id
                            ? "bg-[#f97316]/10 text-[#f97316]"
                            : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-5">
                  {/* Text source */}
                  {kbSourceTab === "text" && (
                    <form onSubmit={handleTrainText} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Refund Policy"
                          value={inputTitle}
                          onChange={(e) => setInputTitle(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Content</label>
                        <textarea
                          placeholder="Paste FAQ answers, policies, product details, or any knowledge the bot should learn…"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          rows={5}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-y leading-relaxed"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1">{inputText.length.toLocaleString()} characters</p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!inputText.trim() || !inputTitle.trim() || !botId}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <Plus className="size-3.5" /> Add to Knowledge
                        </button>
                      </div>
                    </form>
                  )}

                  {/* URL source */}
                  {kbSourceTab === "url" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Website URL</label>
                        <input
                          type="url"
                          placeholder="https://example.com"
                          value={inputUrl}
                          onChange={(e) => setInputUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1 flex items-center gap-1">
                          <Sparkles className="size-3 text-[#f97316]" /> Scan the sitemap to list every page, then tick which ones to index.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleScanSitemap}
                          disabled={!inputUrl.trim() || scanningSitemap}
                          className="px-3 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {scanningSitemap ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                          {scanningSitemap && knowledgeProgress?.status === "active"
                            ? `Scanning sitemap (${knowledgeProgress.percent}%)`
                            : "Scan sitemap"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleTrainUrl(e as unknown as React.FormEvent)}
                          disabled={!inputUrl.trim() || !botId}
                          className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <Link2 className="size-3.5" /> Just this page
                        </button>
                      </div>

                      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setBulkUrlsOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5"><Layers className="size-3.5" /> Bulk add URLs (paste a list)</span>
                          {bulkUrlsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        </button>
                        {bulkUrlsOpen && (
                          <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                            <textarea
                              rows={5}
                              value={bulkUrlsText}
                              onChange={(e) => setBulkUrlsText(e.target.value)}
                              placeholder={"https://example.com/page-1\nhttps://example.com/page-2\nhttps://example.com/page-3"}
                              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] text-neutral-400">One URL per line, up to 100.</p>
                              <button
                                type="button"
                                onClick={handleBulkAddUrls}
                                disabled={!bulkUrlsText.trim() || crawlingPages || !botId}
                                className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                              >
                                {crawlingPages ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
                                {crawlingPages && knowledgeProgress?.status === "active"
                                  ? `Indexing (${knowledgeProgress.percent}%)`
                                  : "Index all"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {discoveredUrls.length > 0 && (
                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                            <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">{selectedUrls.size} of {discoveredUrls.length} selected</span>
                            <div className="flex gap-3 text-[11px] font-semibold text-[#f97316]">
                              <button type="button" onClick={() => setSelectedUrls(new Set(discoveredUrls))} className="cursor-pointer hover:underline">Select all</button>
                              <button type="button" onClick={() => setSelectedUrls(new Set())} className="cursor-pointer hover:underline">None</button>
                            </div>
                          </div>
                          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850">
                            {discoveredUrls.map((u) => (
                              <label key={u} className="flex items-center gap-2.5 px-3 py-2 text-[11px] cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900">
                                <input
                                  type="checkbox"
                                  checked={selectedUrls.has(u)}
                                  onChange={(e) => { const next = new Set(selectedUrls); if (e.target.checked) next.add(u); else next.delete(u); setSelectedUrls(next); }}
                                  className="sr-only"
                                />
                                <span className={`size-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedUrls.has(u) ? "bg-[#f97316] border-[#f97316]" : "border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900"}`}>
                                  {selectedUrls.has(u) && <Check className="size-3 text-white" strokeWidth={3.5} />}
                                </span>
                                <span className="truncate text-neutral-700 dark:text-neutral-300">{u}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end p-2 border-t border-neutral-100 dark:border-neutral-800">
                            <button
                              type="button"
                              onClick={handleCrawlSelected}
                              disabled={!selectedUrls.size || crawlingPages || !botId}
                              className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                            >
                              {crawlingPages ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                              {crawlingPages && knowledgeProgress?.status === "active"
                                ? `Crawling (${knowledgeProgress.percent}%)`
                                : `Crawl selected (${selectedUrls.size})`}
                            </button>
                          </div>
                        </div>
                      )}

                      {crawlSummary && <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{crawlSummary}</p>}
                    </div>
                  )}

                  {/* File upload */}
                  {kbSourceTab === "file" && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isKnowledgeLoading || !botId}
                        className="w-full border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-center hover:border-[#f97316]/50 hover:bg-[#f97316]/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isKnowledgeLoading ? (
                          <div className="w-full max-w-sm flex flex-col items-center gap-2.5">
                            <div className="flex items-center gap-2">
                              <Loader2 className="size-5 text-[#f97316] animate-spin" />
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200 truncate max-w-xs">
                                Indexing {uploadingFile}…
                              </span>
                              {knowledgeProgress && (
                                <span className="text-xs font-mono font-black text-[#f97316] bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-900/50">
                                  {knowledgeProgress.percent}%
                                </span>
                              )}
                            </div>
                            {knowledgeProgress && (
                              <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden relative shadow-inner">
                                <div
                                  className="h-full bg-gradient-to-r from-[#f97316] via-orange-500 to-amber-400 rounded-full transition-all duration-300 relative overflow-hidden"
                                  style={{ width: `${Math.max(4, Math.min(100, knowledgeProgress.percent))}%` }}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] text-neutral-400 font-medium">
                              {knowledgeProgress?.detail || "Parsing structure & extracting text chunks..."}
                            </p>
                          </div>
                        ) : (
                          <>
                            <FileUp className="size-6 text-neutral-400" />
                            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Click to upload a document</span>
                            <span className="text-[10px] text-neutral-400">PDF, DOCX, TXT, MD - up to 20MB</span>
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-neutral-400 text-center">Uploaded files are sent to the backend, chunked, and embedded automatically.</p>
                    </div>
                  )}

                  {/* Google Drive folder */}
                  {kbSourceTab === "drive" && (
                    <form onSubmit={handleIndexDriveFolder} className="space-y-3">
                      {!googleConnected && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                          <AlertCircle className="size-3.5 shrink-0" />
                          Connect Google in Agent Settings first for private folders. Public folders work without it.
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Folder URL or ID</label>
                        <input
                          type="text"
                          placeholder="https://drive.google.com/drive/folders/…"
                          value={driveFolderUrl}
                          onChange={(e) => setDriveFolderUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={driveMaxFiles}
                          onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                          className="w-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      {driveIndexError && <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>}
                      {driveIndexSuccess && <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{driveIndexSuccess}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <RefreshCw className="size-3 text-neutral-400 shrink-0" />
                          <ModernSelect
                            value={driveSyncSchedule}
                            options={syncScheduleOptions}
                            onChange={(v) => handleSetDriveSyncSchedule("gdrive", v as "off" | "daily" | "weekly" | "monthly")}
                            size="sm"
                            className="min-w-[165px]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isIndexingDrive || !driveFolderUrl.trim()}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isIndexingDrive ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                          Index Folder
                        </button>
                      </div>
                      <p className="text-[9px] text-neutral-400">Auto re-sync requires indexing this folder at least once first.</p>
                    </form>
                  )}

                  {/* OneDrive folder */}
                  {kbSourceTab === "onedrive" && (
                    <form onSubmit={(e) => handleIndexDriveFolder(e, "onedrive")} className="space-y-3">
                      {!microsoftConnected && (
                        <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                          <AlertCircle className="size-3.5 shrink-0" />
                          Connect Microsoft in Agent Settings first to index OneDrive folders.
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">OneDrive Folder URL or ID</label>
                        <input
                          type="text"
                          placeholder="https://onedrive.live.com/… or folder ID"
                          value={driveFolderUrl}
                          onChange={(e) => setDriveFolderUrl(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files</label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={driveMaxFiles}
                          onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                          className="w-32 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                      </div>
                      {driveIndexError && <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>}
                      {driveIndexSuccess && <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">{driveIndexSuccess}</p>}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <RefreshCw className="size-3 text-neutral-400 shrink-0" />
                          <ModernSelect
                            value={onedriveSyncSchedule}
                            options={syncScheduleOptions}
                            onChange={(v) => handleSetDriveSyncSchedule("onedrive", v as "off" | "daily" | "weekly" | "monthly")}
                            size="sm"
                            className="min-w-[165px]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isIndexingDrive || !driveFolderUrl.trim() || !microsoftConnected}
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isIndexingDrive ? <Loader2 className="size-3.5 animate-spin" /> : <HardDrive className="size-3.5" />}
                          Index OneDrive Folder
                        </button>
                      </div>
                      <p className="text-[9px] text-neutral-400">Auto re-sync requires indexing this folder at least once first.</p>
                    </form>
                  )}

                  {/* Products & Media Catalog */}
                  {kbSourceTab === "products" && (
                    <ProductsMediaCatalog
                      botId={botId}
                      fetchWithFallback={fetchWithFallback}
                      primaryColor={primaryColor}
                    />
                  )}
                </div>
              </div>

              {/* Unanswered questions (knowledge gaps) */}
              {unanswered.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-amber-200 dark:border-amber-900 flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Unanswered questions
                    </h4>
                    <span className="text-amber-400 text-[11px]">({unanswered.length})</span>
                    <span className="text-[11px] text-amber-500/70 dark:text-amber-500/60 normal-case ml-1">- visitors asked these but the bot didn&apos;t know. Answer to retrain.</span>
                  </div>
                  <div className="divide-y divide-amber-100 dark:divide-amber-900/50">
                    {unanswered.map((u) => (
                      <div key={u.id} className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-neutral-700 dark:text-neutral-200 flex-1">{u.question}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { setAnsweringId(answeringId === u.id ? null : u.id); setAnswerText(""); }}
                              className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                            >
                              {answeringId === u.id ? "Cancel" : "Answer"}
                            </button>
                            <button
                              onClick={() => dismissUnanswered(u.id)}
                              className="px-2 py-1 text-[10px] font-medium rounded-full text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                        {answeringId === u.id && (
                          <div className="mt-2.5 flex flex-col gap-2">
                            <textarea
                              value={answerText}
                              onChange={(e) => setAnswerText(e.target.value)}
                              placeholder="Write the answer - it'll be saved to your knowledge base and the bot will use it next time."
                              rows={3}
                              className="w-full text-xs bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 focus:outline-none focus:border-amber-400 resize-y"
                            />
                            <button
                              onClick={() => resolveUnanswered(u.id, u.question)}
                              disabled={!answerText.trim()}
                              className="self-end px-3.5 py-1.5 text-[11px] font-semibold rounded-lg bg-[#f97316] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                            >
                              Save &amp; train
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources List */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3 flex-wrap rounded-t-2xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                    {t("training_data")}
                    <span className="text-neutral-300 dark:text-neutral-600 normal-case">({sources.length})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* Type filter */}
                    <div className="flex items-center gap-0.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800">
                      {(["all", "text", "url", "file"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setSourceTypeFilter(f)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                            sourceTypeFilter === f ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    {/* Search */}
                    <div className="relative">
                      <Search className="size-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search sources…"
                        value={sourcesSearch}
                        onChange={(e) => setSourcesSearch(e.target.value)}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-[11px] w-40 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>
                    {/* Crawl all URL sources now */}
                    {sources.some((s) => s.type === "url") && (
                      <button
                        onClick={handleCrawlAll}
                        disabled={crawlingAll || recrawlingSourceId !== null}
                        title="Re-crawl every URL source now"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-950 rounded-lg text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        <RefreshCw className={`size-3.5 ${crawlingAll ? "animate-spin text-[#f97316]" : ""}`} />
                        {crawlingAll && knowledgeProgress?.status === "active"
                          ? `Crawling (${knowledgeProgress.percent}%)`
                          : "Crawl All"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-neutral-100 dark:divide-neutral-850">
                  {(() => {
                    const q = sourcesSearch.toLowerCase();
                    const filtered = sources.filter(s =>
                      (sourceTypeFilter === "all" || s.type === sourceTypeFilter) &&
                      (s.name.toLowerCase().includes(q) || (s.content || "").toLowerCase().includes(q))
                    );

                    if (sources.length === 0) {
                      return (
                        <div className="p-10 text-center">
                          <Database className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                          <p className="text-xs font-semibold text-neutral-500 mt-3">No knowledge sources yet</p>
                          <p className="text-[10px] text-neutral-400 mt-1">Add your first source above to start training your assistant.</p>
                        </div>
                      );
                    }
                    if (filtered.length === 0) {
                      return <div className="p-10 text-center text-xs text-neutral-400">No sources match your filter.</div>;
                    }

                    return filtered.map((s) => {
                      const TypeIcon = s.type === "url" ? Globe : s.type === "file" ? FileUp : Type;
                      const expanded = expandedSourceId === s.id;
                      return (
                        <div key={s.id} className="p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0 mt-0.5">
                              <TypeIcon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-xs">{s.name}</p>
                                {s.status === "trained" ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                    <Check className="size-2.5" /> Trained
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                                    <Loader2 className="size-2.5 animate-spin" /> Training
                                    {knowledgeProgress && knowledgeProgress.status === "active" && (
                                      <span className="font-mono font-bold">({knowledgeProgress.percent}%)</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-neutral-400">
                                <span className="capitalize">{s.type}</span>
                                <span className="flex items-center gap-1"><FileText className="size-3" /> {(s.charCount || 0).toLocaleString()} chars</span>
                                {s.content && (
                                  <button
                                    onClick={() => setExpandedSourceId(expanded ? null : s.id)}
                                    className="text-[#f97316] hover:underline font-semibold cursor-pointer"
                                  >
                                    {expanded ? "Hide" : "Preview"}
                                  </button>
                                )}
                              </div>
                              {s.type === "url" && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleRecrawlNow(s.id, s.name)}
                                    disabled={recrawlingSourceId === s.id}
                                    aria-label="Re-crawl now"
                                    title="Re-crawl now"
                                    className="shrink-0 text-neutral-400 hover:text-[#f97316] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default flex items-center gap-1"
                                  >
                                    <RefreshCw className={`size-3 ${recrawlingSourceId === s.id ? "animate-spin text-[#f97316]" : ""}`} />
                                    {recrawlingSourceId === s.id && knowledgeProgress?.status === "active" && (
                                      <span className="text-[9px] font-mono text-[#f97316] font-bold">
                                        {knowledgeProgress.percent}%
                                      </span>
                                    )}
                                  </button>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setCrawlDropdownOpen(crawlDropdownOpen === s.id ? null : s.id)}
                                      className={`flex items-center gap-1 text-[10px] font-semibold pl-2.5 pr-2 py-1 rounded-full border cursor-pointer transition-colors whitespace-nowrap ${
                                        s.crawlSchedule && s.crawlSchedule !== "off"
                                          ? "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400"
                                          : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400"
                                      }`}
                                    >
                                      {s.crawlSchedule === "daily" ? "Re-crawl daily"
                                        : s.crawlSchedule === "weekly" ? "Re-crawl weekly"
                                        : s.crawlSchedule === "monthly" ? "Re-crawl monthly"
                                        : "No auto re-crawl"}
                                      <ChevronDown className={`size-3 transition-transform ${crawlDropdownOpen === s.id ? "rotate-180" : ""}`} />
                                    </button>
                                    {crawlDropdownOpen === s.id && (
                                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[170px] w-max rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden">
                                        {([
                                          { value: "off", label: "No auto re-crawl" },
                                          { value: "daily", label: "Re-crawl daily" },
                                          { value: "weekly", label: "Re-crawl weekly" },
                                          { value: "monthly", label: "Re-crawl monthly" },
                                        ] as const).map((opt) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => { handleSetCrawlSchedule(s.id, opt.value); setCrawlDropdownOpen(null); }}
                                            className={`w-full text-left px-3 py-2 text-[11px] font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 whitespace-nowrap ${
                                              (s.crawlSchedule || "off") === opt.value
                                                ? "text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30"
                                                : "text-neutral-700 dark:text-neutral-300"
                                            }`}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {s.crawlSchedule && s.crawlSchedule !== "off" && s.nextCrawlAt && (
                                    <span className="text-[10px] text-neutral-400">
                                      Next: {new Date(s.nextCrawlAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}
                              {expanded && s.content && (
                                <div className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
                                  {s.content.slice(0, 2000)}{s.content.length > 2000 ? "…" : ""}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteSource(s.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer shrink-0"
                              title="Delete source"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
                </div>
              }
            />
  );
}
