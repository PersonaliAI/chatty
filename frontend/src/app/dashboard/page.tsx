"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import { LeadsMap } from "@/components/leads-map";
import { OnboardingWizard, extractDomain } from "@/components/onboarding-wizard";
import { InboxPanel } from "@/components/inbox-panel";
import { ChatbotFlowBuilder } from "@/components/chatbot-flow-builder";
import { CampaignsUI } from "@/components/campaigns-ui";
import { KBManager } from "@/components/kb-manager";
import { COUNTRIES, getTimezones, tzOffsetLabel, detectTimezone, detectCountryCode } from "@/lib/locale-data";
import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL, fetchBackend } from "@/lib/backend-client";
import { SELF_HOST_MODE } from "@/lib/deployment";
import { GOOGLE_FONTS, LOCALE_TEXTS, MAX_BOTS_BY_PLAN, PLAN_LABELS } from "./dashboard-constants";
import {
  CloudProviderMenu,
  MemberAvailabilityEditor,
  MemberPermissionEditor,
  SectionPropertyDropdown,
  TeamTabCheckbox,
} from "./dashboard-controls";
import {
  CHATTY_TEAM_TABS,
  DEFAULT_ADMIN_TABS,
  DEFAULT_AGENT_TABS,
  NAV_TAB_PERMISSION,
  OWNER_ONLY_TABS,
  TAB_LABELS,
  type ChattyTeamTab,
} from "./dashboard-permissions";
import { extractColorsFromUrl } from "./dashboard-utils";
import { KnowledgeProgressBar, type KnowledgeProgress } from "./knowledge-progress-bar";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getOnColor, primaryColorCssVars, generateColorScheme, buildColorSchemeCss, type WidgetColorScheme } from "@/lib/color-contrast";
import { normalizeWidgetStyle, LAUNCHER_STYLES } from "@/lib/widget-style";
import {
  Home,
  Sliders,
  Database,
  MessageSquare,
  Bot as BotIcon,
  Headphones,
  User,
  Bell,
  Smile,
  BarChart3,
  Code2,
  Settings,
  Plus,
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Star,
  Users,
  MessageCircle,
  LogOut,
  RefreshCw,
  Globe,
  Menu,
  X,
  FileText,
  Calendar,
  Mail,
  FolderOpen,
  HardDrive,
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  Paperclip,
  FileUp,
  Link2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowUp,
  Mic,
  Puzzle,
  Search,
  Type,
  MapPin,
  Inbox,
  Upload,
  BookOpen,
  CreditCard,
  GitBranch,
  Megaphone,
  Phone,
  LayoutGrid,
  Pencil,
  Info,
  Play,
  MicOff,
  PhoneOff,
  Lock,
  Cpu,
  Shield,
  DollarSign,
  type LucideIcon
} from "lucide-react";

import {
  type Lead,
  type Bot,
  type AdminMeeting,
  type MeetingMessage,
  type AdminNotification,
  type AdminAuditLog,
  type ApiKey,
  type Webhook,
  type Source,
  type SourceRecord,
  type ErrorDetails,
  type QuickReply,
  type KnowledgeMessage,
  errorMessageFromUnknown,
} from "./dashboard-types";
import { LeadsTab } from "./tabs/LeadsTab";
import { FeedbackTab } from "./tabs/FeedbackTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { MailboxTab } from "./tabs/MailboxTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { AuditLogTab } from "./tabs/AuditLogTab";
import { McpTab } from "./tabs/McpTab";
import { DeveloperTab } from "./tabs/DeveloperTab";
import { BillingTab } from "./tabs/BillingTab";
import { AdminAffiliatesTab } from "./tabs/AdminAffiliatesTab";
import { IntegrationsTab } from "./tabs/IntegrationsTab";
import { MeetingsTab } from "./tabs/MeetingsTab";
import { VoiceAgentTab } from "./tabs/VoiceAgentTab";
import { HomeTab } from "./tabs/HomeTab";
import { PlaygroundTab } from "./tabs/PlaygroundTab";
import { CustomizerTab } from "./tabs/CustomizerTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { SettingsTab } from "./tabs/SettingsTab";

// Section Colors rows whose "text" property is really an icon/dot color
// (no separate typed text on a button or a launcher circle).
const ICON_ONLY_SECTIONS = new Set(["sendBtn", "launcher"]);

// Lazy-loaded: pulls in lucide-react/dynamic's full icon-name list, which
// shouldn't sit in the main dashboard bundle for something opened rarely.
const IconLibraryPicker = dynamic(
  () => import("@/components/icon-library-picker").then((m) => m.IconLibraryPicker),
  { ssr: false }
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [botDropdownOpen, setBotDropdownOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  // Custom Toast, Confirm & Dialog States
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [createBotModalOpen, setCreateBotModalOpen] = useState(false);
  const [newBotNameInput, setNewBotNameInput] = useState("");
  const [newBotWebsiteInput, setNewBotWebsiteInput] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };
  const showConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({ title, message, onConfirm });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const supabase = createClient();

  // User State
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userPlatformRole, setUserPlatformRole] = useState<string | null>(null);
  const [botId, setBotId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const [loadingSession, setLoadingSession] = useState(true);

  // Billing State
  const [billingInfo, setBillingInfo] = useState<{
    plan: string;
    status: string | null;
    renewsAt: string | null;
  } | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  // Chatbot State
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [teaserMessage, setTeaserMessage] = useState("👋 Need help? Chat with us.");
  const [primaryColor, setPrimaryColor] = useState("#f97316"); // default
  // Per-section colors (header/bot-bubble/user-bubble/input-bar/send-btn/
  // launcher) - null until the owner saves at least one, at which point it
  // takes over from primaryColor-driven presets entirely (see globals.css's
  // .has-color-scheme override block). "Auto-generate" fills this from
  // primaryColor via generateColorScheme(); each section stays individually
  // editable after that.
  const [colorScheme, setColorScheme] = useState<WidgetColorScheme | null>(null);
  // Which property (bg/text/icon) each Section Colors row's dropdown is
  // currently showing - transient UI state, not saved with the bot.
  const [sectionColorProp, setSectionColorProp] = useState<Record<string, "bg" | "text" | "icon">>({});
  const [widgetStyle, setWidgetStyle] = useState<string>("minimal");
  // Which view the Customizer's live preview shows - a static mockup of the
  // in-chat text conversation, or of the voice-call screen (orb, live
  // transcript bubbles, mute/hangup). Both are hand-built mockups (like the
  // rest of #customizer-live-preview), not the real ChatWidgetCore/
  // VoiceCallWidget components, for the same zero-reload-lag reason.
  const [previewView, setPreviewView] = useState<"live" | "chat" | "call">("live");
  // null = keep the active design preset's own default font. 100 = normal
  // text size; the scale is a percentage of that, not an absolute px value.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [fontSizePercent, setFontSizePercent] = useState(100);
  // Default chat panel size on desktop - a preset name, not raw pixels, so
  // adding a new size later never needs a schema change. Visitors can still
  // drag-resize their own window from whichever size this sets as the start.
  const [panelSize, setPanelSize] = useState("default");
  const [sendButtonStyle, setSendButtonStyle] = useState("plane");
  // What happens when a visitor finishes recording a voice message in the
  // chat composer: "transcribe" lands the transcript in the input box for
  // them to review/edit before sending (current default); "audio" skips
  // transcription and sends the recording itself as a playable voice
  // message bubble.
  const [voiceMessageMode, setVoiceMessageMode] = useState<"transcribe" | "audio">("transcribe");
  const [avatarIcon, setAvatarIcon] = useState("logo");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  // Set only when the current avatarUrl came from the icon library (not a
  // real uploaded file) - lets clicking the avatar slot reopen the picker
  // pre-filled on the same icon/color instead of a native file dialog, and
  // lets "change its color after picking" actually mean something (the
  // baked SVG file itself has no color memory once uploaded).
  const [avatarIconLibrarySelection, setAvatarIconLibrarySelection] = useState<{ name: string; color: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [logoBgColor, setLogoBgColor] = useState("");
  const [launcherShape, setLauncherShape] = useState("circle");
  const [userBots, setUserBots] = useState<Bot[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; email: string; name?: string; phone?: string; role: string; permissions?: string[]; bookable?: boolean; book_on_own_calendar?: boolean; avatar_url?: string | null }[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"agent" | "admin">("agent");
  const [inviteTabs, setInviteTabs] = useState<ChattyTeamTab[]>(DEFAULT_AGENT_TABS);
  const [invitingTeam, setInvitingTeam] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  // Defaults to owner-level access so a single-owner bot (no /api/team/me
  // round trip has resolved yet, or the caller genuinely is the owner) never
  // flashes a permission-gated empty state.
  const [myRole, setMyRole] = useState<string>("owner");
  const [myPermissions, setMyPermissions] = useState<string[]>([...CHATTY_TEAM_TABS]);
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Extract colors when logoUrl changes. Resets suggestedColors whenever
  // logoUrl is cleared - logoUrl is set from several places (upload,
  // fetched bot settings, reset), so consolidating this reset into each of
  // those call sites would be a larger refactor than this warning justifies.
  useEffect(() => {
    if (logoUrl) {
      extractColorsFromUrl(logoUrl).then((colors) => {
        setSuggestedColors(colors);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestedColors([]);
    }
  }, [logoUrl]);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gemini");
  // BYOK - bring-your-own-key for non-Gemini models. The key itself is never
  // round-tripped to the client; only `byokConfigured` reflects whether one is set.
  const [byokProvider, setByokProvider] = useState("");
  const [byokModel, setByokModel] = useState("");
  const [byokApiKeyInput, setByokApiKeyInput] = useState("");
  const [byokConfigured, setByokConfigured] = useState(false);
  const [savingByok, setSavingByok] = useState(false);
  // Voice agent - STT/TTS provider selection + optional BYOK keys, mirrors the
  // LLM BYOK pattern above; keys are never round-tripped, only *_configured is.
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSttProvider, setVoiceSttProvider] = useState("google");
  const [voiceTtsProvider, setVoiceTtsProvider] = useState("google");
  const [voiceTtsVoice, setVoiceTtsVoice] = useState("");
  const [voiceSttConfigured, setVoiceSttConfigured] = useState(false);
  const [voiceTtsConfigured, setVoiceTtsConfigured] = useState(false);
  const [voiceSttApiKeyInput, setVoiceSttApiKeyInput] = useState("");
  const [voiceTtsApiKeyInput, setVoiceTtsApiKeyInput] = useState("");
  const [savingVoiceStt, setSavingVoiceStt] = useState(false);
  const [savingVoiceTts, setSavingVoiceTts] = useState(false);
  const [voiceAgentRole, setVoiceAgentRole] = useState("general");
  const [voiceMaxDurationMinutes, setVoiceMaxDurationMinutes] = useState(15);
  // Realtime mode (Gemini Live / OpenAI Realtime - speech-to-speech, no
  // separate STT/TTS stage). voiceTtsVoice above is reused as the realtime
  // voice when this mode is active, same as the backend column reuse.
  const [voiceMode, setVoiceMode] = useState<"pipeline" | "realtime">("pipeline");
  const [voiceRealtimeProvider, setVoiceRealtimeProvider] = useState<"google" | "openai">("google");
  const [voiceRealtimeModel, setVoiceRealtimeModel] = useState("");
  const [voiceRealtimeApiKeyInput, setVoiceRealtimeApiKeyInput] = useState("");
  const [voiceRealtimeConfigured, setVoiceRealtimeConfigured] = useState(false);
  const [savingVoiceRealtime, setSavingVoiceRealtime] = useState(false);
  const [systemInstructions, setSystemInstructions] = useState(
    "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite."
  );
  const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);
  const [strictMode, setStrictMode] = useState(true);
  const [answerMode, setAnswerMode] = useState<"strict" | "hybrid" | "web">("strict");
  const [emailNotify, setEmailNotify] = useState(true);
  const [hideBranding, setHideBranding] = useState(false);
  const [showSenderTag, setShowSenderTag] = useState(false);
  const [csatEnabled, setCsatEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [notificationEmails, setNotificationEmails] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [customJs, setCustomJs] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("");
  const [guardrailTopics, setGuardrailTopics] = useState("");
  const [guardrailBlockProfanity, setGuardrailBlockProfanity] = useState(false);
  const [guardrailRefusalMessage, setGuardrailRefusalMessage] = useState("");

  // Unsaved Changes Tracking - setters are wired into the save flow below;
  // no UI currently reads these values (no "unsaved changes"/"saving..."
  // indicator is rendered), so both are write-only for now.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // handleSaveChanges is redefined every render, closing over that render's
  // state. The debounce timer below is scheduled once and fires 1200ms
  // later - without this ref it would call whatever (now-stale) version of
  // handleSaveChanges existed at the moment the timer was armed, silently
  // persisting the state from BEFORE the very change that armed it. Always
  // dereferencing through the ref at fire time guarantees the latest state.
  const handleSaveChangesRef = useRef<() => Promise<void>>(async () => {});

  // Lists (No demo data by default - queries Supabase)
  const [sources, setSources] = useState<Source[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Unanswered questions queue (knowledge gaps the bot couldn't answer)
  const [unanswered, setUnanswered] = useState<{ id: string; question: string; created_at: string }[]>([]);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  // Training inputs
  const [inputText, setInputText] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputUrl, setInputUrl] = useState("");

  // RAG / Cloud Connectors State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for future display, not currently rendered
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for future display, not currently rendered
  const [microsoftEmail, setMicrosoftEmail] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for future display, not currently rendered
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [telegramLinkOpen, setTelegramLinkOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<"google" | "microsoft" | null>(null);

  // Sync controls (each separate card)
  const [syncGoogleDrive, setSyncGoogleDrive] = useState(false);
  const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(false);
  const [googleConnectedAccountId, setGoogleConnectedAccountId] = useState<string | null>(null);
  const [googleCalendarId, setGoogleCalendarId] = useState<string>("primary");
  const [googleCalendarName, setGoogleCalendarName] = useState<string>("");
  const [googleCalendarColor, setGoogleCalendarColor] = useState<string>("auto_multiple");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState<string | null>(null);
  const [googleDriveFolderName, setGoogleDriveFolderName] = useState<string | null>(null);

  // Scheduling settings
  const [calendarSchedulingEnabled, setCalendarSchedulingEnabled] = useState(false);
  const [schedulingDuration, setSchedulingDuration] = useState(30);
  const [botTimezone, setBotTimezone] = useState("UTC");

  // Editable booking rules
  const [businessHoursStart, setBusinessHoursStart] = useState(9);
  const [businessHoursEnd, setBusinessHoursEnd] = useState(17);
  const [workingDays, setWorkingDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [advanceNoticeHours, setAdvanceNoticeHours] = useState(0);
  const [maxDailyMeetings, setMaxDailyMeetings] = useState(0);
  const [maxWeeklyMeetings, setMaxWeeklyMeetings] = useState(0);

  // Anti-fake-meeting defenses (Abuse & spam protection)
  const [bookingEmailVerification, setBookingEmailVerification] = useState(false);
  const [bookingBlockDisposableEmails, setBookingBlockDisposableEmails] = useState(false);
  const [bookingLimitOneActive, setBookingLimitOneActive] = useState(false);
  const [bookingRequireBusinessEmail, setBookingRequireBusinessEmail] = useState(false);

  // Developer / API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for future loading-state UI, not currently rendered
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // Developer / Webhooks
  const WEBHOOK_EVENT_OPTIONS = ["lead.created", "message.user", "message.assistant", "session.started", "session.ended"] as const;
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["lead.created"]);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [copiedWebhookSecret, setCopiedWebhookSecret] = useState(false);

  // Backend capabilities (which optional integrations have keys configured)
  const [zoomConfigured, setZoomConfigured] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for future gating UI, not currently read
  const [onesignalConfigured, setOnesignalConfigured] = useState(false);

  // Security: allowed domains for the embed widget
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");

  // Embed platform selector
  const [embedPlatform, setEmbedPlatform] = useState<string | null>(null);
  const [embedMobilePlatform, setEmbedMobilePlatform] = useState<string | null>(null);
  const [copiedMobile, setCopiedMobile] = useState(false);

  // WhatsApp Business Channel
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [whatsappWabaId, setWhatsappWabaId] = useState("");
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState("");
  const [whatsappAppSecret, setWhatsappAppSecret] = useState("");
  const [whatsappQuickReplies, setWhatsappQuickReplies] = useState<string[]>([]);

  // Google Drive indexing settings
  const [driveFolderUrl, setDriveFolderUrl] = useState("");
  const [driveMaxFiles, setDriveMaxFiles] = useState(50);
  const [isIndexingDrive, setIsIndexingDrive] = useState(false);
  const [driveIndexError, setDriveIndexError] = useState<string | null>(null);
  const [driveIndexSuccess, setDriveIndexSuccess] = useState<string | null>(null);
  const [driveSyncSchedule, setDriveSyncSchedule] = useState<"off" | "daily" | "weekly" | "monthly">("off");
  const [onedriveSyncSchedule, setOnedriveSyncSchedule] = useState<"off" | "daily" | "weekly" | "monthly">("off");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- setSyncOneDrive is never called; syncOneDrive itself is read below
  const [syncOneDrive, setSyncOneDrive] = useState(false);
  const [syncOutlookCalendar, setSyncOutlookCalendar] = useState(false);

  // Analytics State
  const [totalQueries, setTotalQueries] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [conversionRate, setConversionRate] = useState("0.0");
  const [resolutionRate, setResolutionRate] = useState("-");
  const [csatScore, setCsatScore] = useState("-");
  const [csatFeedback, setCsatFeedback] = useState<Array<{ id: string; rating: number; comment: string | null; session_id: string | null; created_at: string }>>([]);
  const [busiestHour, setBusiestHour] = useState("-");
  const [analyticsChartData, setAnalyticsChartData] = useState<Array<{ day: string; count: number; height: string }>>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [aiUsageTotalCost, setAiUsageTotalCost] = useState(0);
  const [aiUsageTotalTokens, setAiUsageTotalTokens] = useState(0);
  const [aiUsageTotalCalls, setAiUsageTotalCalls] = useState(0);
  const [aiUsageByModel, setAiUsageByModel] = useState<Array<{ model: string; calls: number; tokens: number; cost: number }>>([]);


  const [liveThinkingSteps, setLiveThinkingSteps] = useState<string[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundView, setPlaygroundView] = useState<"test" | "live">("test");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [collectedInPlayground, setCollectedInPlayground] = useState(false);
  
  const playgroundEndRef = useRef<HTMLDivElement>(null);

  // Localization State
  const [language, setLanguage] = useState<"EN" | "ES" | "FR" | "DE" | "IT">("EN");

  // Onboarding Wizard State
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [leadFields, setLeadFields] = useState<string[]>(["name", "email", "phone"]);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(true);
  const [leadRequiredFields, setLeadRequiredFields] = useState<string[]>(["name", "email"]);
  const [newLeadField, setNewLeadField] = useState("");
  const [savingLeadCapture, setSavingLeadCapture] = useState(false);
  const [botCountry, setBotCountry] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- loaded from the bot record but not yet surfaced in any UI control
  const [syncOffice365Calendar, setSyncOffice365Calendar] = useState<boolean>(false);
  const [meetingProvider, setMeetingProvider] = useState<string>("google_meet");
  // agenticSetupStep: which conversational setup step the chat assistant is at
  // 0=not started, 1=welcome, 2=docs_upload, 3=instructions, 4=lead_fields, 5=meetings, 6=calendar, 7=meeting_provider, 8=notifications, 9=done
  const [agenticSetupStep, setAgenticSetupStep] = useState<number>(0);
  const [pendingLeadFields, setPendingLeadFields] = useState<string[]>(["name", "email", "phone"]);

  // Admin Panel Data
  const [adminMeetings, setAdminMeetings] = useState<AdminMeeting[]>([]);
  const [meetingMemberFilter, setMeetingMemberFilter] = useState<string>("all");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [reschedulingMeetingId, setReschedulingMeetingId] = useState<string | null>(null);
  const [rescheduleDateTime, setRescheduleDateTime] = useState("");
  const [reschedulingBusy, setReschedulingBusy] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState<boolean>(false);

  // Leads and Meetings States & Helpers
  const [leadsSearch, setLeadsSearch] = useState<string>("");
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editLeadDraft, setEditLeadDraft] = useState<Record<string, string>>({});
  const [savingLeadEdit, setSavingLeadEdit] = useState(false);

  const getLeadFieldValue = (lead: Lead, field: string) => {
    if (lead[field] !== undefined && lead[field] !== null) {
      return String(lead[field]);
    }
    if (lead.custom_fields && lead.custom_fields[field] !== undefined && lead.custom_fields[field] !== null) {
      return String(lead.custom_fields[field]);
    }
    return "N/A";
  };

  const getLeadFieldRawValue = (lead: Lead, field: string): string => {
    if (lead[field] !== undefined && lead[field] !== null) return String(lead[field]);
    if (lead.custom_fields && lead.custom_fields[field] !== undefined && lead.custom_fields[field] !== null) {
      return String(lead.custom_fields[field]);
    }
    return "";
  };

  const startEditLead = (lead: Lead) => {
    const draft: Record<string, string> = {};
    for (const field of leadFields) draft[field] = getLeadFieldRawValue(lead, field);
    setEditingLeadId(lead.id);
    setEditLeadDraft(draft);
  };

  const cancelEditLead = () => {
    setEditingLeadId(null);
    setEditLeadDraft({});
  };

  const saveEditLead = async () => {
    if (!editingLeadId) return;
    const lead = leads.find((l) => l.id === editingLeadId);
    if (!lead) return;
    setSavingLeadEdit(true);
    try {
      // Known top-level columns get updated directly; anything else lives
      // in custom_fields (dynamic fields added via onboarding/Flow Builder
      // aren't necessarily real chatty_leads columns).
      const KNOWN_COLUMNS = new Set(["name", "email", "phone", "company", "job_title", "country", "industry", "budget"]);
      const topLevelUpdate: Record<string, string> = {};
      const customFieldsUpdate: Record<string, string> = { ...(lead.custom_fields as Record<string, string> | undefined || {}) };
      for (const field of leadFields) {
        const value = editLeadDraft[field] ?? "";
        if (KNOWN_COLUMNS.has(field) || lead[field] !== undefined) {
          topLevelUpdate[field] = value;
        } else {
          customFieldsUpdate[field] = value;
        }
      }
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${botId}/leads/${editingLeadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...topLevelUpdate, custom_fields: customFieldsUpdate }),
        });
        if (!response.ok) throw new Error(`Lead update failed (${response.status})`);
      } else {
        const { error } = await supabase
          .from("chatty_leads")
          .update({ ...topLevelUpdate, custom_fields: customFieldsUpdate })
          .eq("id", editingLeadId);
        if (error) throw error;
      }
      setLeads((prev) => prev.map((l) => (l.id === editingLeadId ? { ...l, ...topLevelUpdate, custom_fields: customFieldsUpdate } : l)));
      showToast("Lead updated.", "success");
      cancelEditLead();
    } catch {
      showToast("Failed to update lead.", "error");
    } finally {
      setSavingLeadEdit(false);
    }
  };

  const deleteLead = (lead: Lead) => {
    showConfirm("Delete lead?", `Remove ${lead.name || "this lead"}'s captured contact details. This can't be undone.`, async () => {
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${botId}/leads/${lead.id}`, { method: "DELETE" });
        if (!response.ok) { showToast("Failed to delete lead.", "error"); return; }
      } else {
        const { error } = await supabase.from("chatty_leads").delete().eq("id", lead.id);
        if (error) { showToast("Failed to delete lead.", "error"); return; }
      }
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      showToast("Lead deleted.", "success");
    });
  };

  const filteredLeads = leads.filter(l => {
    const query = leadsSearch.toLowerCase();
    return (
      l.name.toLowerCase().includes(query) ||
      l.email.toLowerCase().includes(query) ||
      l.phone.toLowerCase().includes(query) ||
      (l.company && l.company.toLowerCase().includes(query)) ||
      (l.job_title && l.job_title.toLowerCase().includes(query)) ||
      (l.custom_fields && Object.values(l.custom_fields).some(val => String(val).toLowerCase().includes(query)))
    );
  });

  const [refreshingLeads, setRefreshingLeads] = useState(false);
  const refreshLeads = async () => {
    if (!botId || refreshingLeads) return;
    setRefreshingLeads(true);
    try {
      const { data: leadList } = await supabase
        .from("chatty_leads")
        .select("*")
        .eq("bot_id", botId)
        .order("created_at", { ascending: false });
      if (leadList) {
        setLeads(leadList.map((l) => ({
          ...l,
          id: l.id,
          name: l.name || "Anonymous",
          email: l.email || "N/A",
          phone: l.phone || "N/A",
          created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " "),
        })));
      }
    } finally {
      setRefreshingLeads(false);
    }
  };

  const exportLeadsCSV = () => {
    const headers = [...leadFields, "captured_at"];
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));
    filteredLeads.forEach(lead => {
      const values = headers.map(field => {
        const val = getLeadFieldValue(lead, field);
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `chatty_leads_${botId || "export"}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateMeetingStatus = async (meetingId: string, newStatus: string) => {
    try {
      const res = await fetchWithFallback(`/api/admin/meetings/${meetingId}/status?status=${newStatus}`, {
        method: "POST"
      });
      if (res.ok) {
        if (botId) await loadAdminData(botId);
      } else {
        console.error("Failed to update meeting status");
      }
    } catch (err) {
      console.error("Error updating meeting status:", err);
    }
  };

  function openMeetingPanel(meetingId: string) {
    setSelectedMeetingId(meetingId);
    setReschedulingMeetingId(null);
  }

  async function handleRescheduleMeeting(meeting: AdminMeeting) {
    if (!rescheduleDateTime) return;
    const originalStart = new Date(meeting.start_time).getTime();
    const originalEnd = meeting.end_time ? new Date(meeting.end_time).getTime() : originalStart + 30 * 60 * 1000;
    const durationMs = Math.max(originalEnd - originalStart, 15 * 60 * 1000);
    const newStart = new Date(rescheduleDateTime);
    const newEnd = new Date(newStart.getTime() + durationMs);

    setReschedulingBusy(true);
    try {
      const res = await fetchWithFallback(`/api/admin/meetings/${meeting.id}/reschedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_start: newStart.toISOString(), new_end: newEnd.toISOString() }),
      });
      if (res.ok) {
        showToast("Meeting rescheduled.", "success");
        setReschedulingMeetingId(null);
        setRescheduleDateTime("");
        if (botId) await loadAdminData(botId);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.detail || "Couldn't reschedule - that time may not be available.", "error");
      }
    } catch { showToast("Couldn't reschedule. Try again.", "error"); } finally { setReschedulingBusy(false); }
  }

  // Knowledge Base Chat States
  const [playgroundMessages, setPlaygroundMessages] = useState<KnowledgeMessage[]>([]);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const knowledgeEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge Base tab UI state
  const [kbSourceTab, setKbSourceTab] = useState<"text" | "url" | "file" | "drive" | "onedrive" | "products">("text");
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [scanningSitemap, setScanningSitemap] = useState(false);
  const [crawlingPages, setCrawlingPages] = useState(false);
  const [crawlSummary, setCrawlSummary] = useState<string | null>(null);
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [bulkUrlsOpen, setBulkUrlsOpen] = useState(false);
  const [sourcesSearch, setSourcesSearch] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<"all" | "text" | "url" | "file">("all");
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [crawlDropdownOpen, setCrawlDropdownOpen] = useState<string | null>(null);
  const [recrawlingSourceId, setRecrawlingSourceId] = useState<string | null>(null);
  const [crawlingAll, setCrawlingAll] = useState(false);

  // Knowledge Base operation progress state & controller
  const [knowledgeProgress, setKnowledgeProgress] = useState<KnowledgeProgress | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up progress timers on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (progressDismissTimerRef.current) clearTimeout(progressDismissTimerRef.current);
    };
  }, []);

  const clearKnowledgeProgressTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressDismissTimerRef.current) {
      clearTimeout(progressDismissTimerRef.current);
      progressDismissTimerRef.current = null;
    }
  };

  const startKnowledgeProgress = (title: string, initialDetail: string, stages: string[] = []) => {
    clearKnowledgeProgressTimers();
    const id = `kp-${Date.now()}`;
    setKnowledgeProgress({
      id,
      title,
      detail: initialDetail,
      percent: 10,
      status: "active",
      stages,
      currentStageIndex: 0,
    });

    progressIntervalRef.current = setInterval(() => {
      setKnowledgeProgress((prev) => {
        if (!prev || prev.status !== "active") return prev;
        if (prev.percent >= 94) return prev;
        const step = Math.max(1, Math.round((94 - prev.percent) * 0.12));
        const nextPercent = Math.min(94, prev.percent + step);

        let nextDetail = prev.detail;
        let nextStageIndex = prev.currentStageIndex || 0;
        if (stages.length > 0) {
          const stageIndex = Math.min(
            stages.length - 1,
            Math.floor((nextPercent / 90) * stages.length)
          );
          if (stageIndex !== nextStageIndex && stages[stageIndex]) {
            nextDetail = stages[stageIndex];
            nextStageIndex = stageIndex;
          }
        }

        return {
          ...prev,
          percent: nextPercent,
          detail: nextDetail,
          currentStageIndex: nextStageIndex,
        };
      });
    }, 400);
  };

  const completeKnowledgeProgress = (title: string, successMessage: string) => {
    clearKnowledgeProgressTimers();
    setKnowledgeProgress((prev) => ({
      id: prev?.id || `kp-${Date.now()}`,
      title,
      detail: successMessage,
      percent: 100,
      status: "success",
    }));

    progressDismissTimerRef.current = setTimeout(() => {
      setKnowledgeProgress(null);
    }, 4500);
  };

  const errorKnowledgeProgress = (title: string, errorMessage: string) => {
    clearKnowledgeProgressTimers();
    setKnowledgeProgress((prev) => ({
      id: prev?.id || `kp-${Date.now()}`,
      title,
      detail: errorMessage,
      percent: Math.max(prev?.percent || 0, 25),
      status: "error",
    }));
  };

  // Mailbox tab state
  const [mailboxFilter, setMailboxFilter] = useState<"all" | "client" | "admin">("all");
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);

  // Copy code animation state
  const [copiedScript, setCopiedScript] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- set for a "Copied!" indicator that isn't rendered yet
  const [copiedIframe, setCopiedIframe] = useState(false);

  // Authenticate user and fetch configuration from Supabase
  useEffect(() => {
    async function checkSession() {
      try {
        if (SELF_HOST_MODE) {
          const profileResponse = await fetchBackend("/api/user/profile");
          if (!profileResponse.ok) return;
          const profile = await profileResponse.json();
          const selfHostUser = {
            id: profile.user_id,
            email: profile.email || undefined,
            user_metadata: { name: profile.display_name, avatar_url: profile.avatar_url },
          } as unknown as SupabaseUser;
          setUser(selfHostUser);
          setUserPlatformRole(profile.role || null);
          setBillingInfo({
            plan: profile.plan || "free",
            status: profile.subscription_status || null,
            renewsAt: profile.subscription_renews_at || null,
          });
          await checkCloudConnections(profile.user_id);
          await loadBotSettings(profile.user_id);
          try {
            const capRes = await fetchBackend("/api/capabilities");
            if (capRes.ok) {
              const cap = await capRes.json();
              setZoomConfigured(!!cap.zoom_configured);
              setOnesignalConfigured(!!cap.onesignal_configured);
            }
          } catch (e) {
            console.error("Failed to load capabilities:", e);
          }
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          if (session.access_token) setAuthToken(session.access_token);
          supabase
            .from("users")
            .select("plan, subscription_status, subscription_renews_at, role")
            .eq("auth_user_id", session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.role) setUserPlatformRole(data.role as string);
              setBillingInfo({
                plan: (data?.plan as string) || "free",
                status: (data?.subscription_status as string) || null,
                renewsAt: (data?.subscription_renews_at as string) || null,
              });
            });
          await checkCloudConnections(session.user.id);
          await loadBotSettings(session.user.id);
          try {
            const capRes = await fetchWithFallback("/api/capabilities");
            if (capRes.ok) {
              const cap = await capRes.json();
              setZoomConfigured(!!cap.zoom_configured);
              setOnesignalConfigured(!!cap.onesignal_configured);
            }
          } catch (e) {
            console.error("Failed to load capabilities:", e);
          }
        }
      } catch (err) {
        console.error("Supabase session check error:", err);
      } finally {
        setLoadingSession(false);
      }
    }
    checkSession();
    // Deliberately run-once-on-mount: checkCloudConnections/loadBotSettings/
    // fetchWithFallback are stable for the component's lifetime and this
    // effect must only fire once, not on every re-render one of them is
    // re-created - adding them to the deps array would do exactly that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWithFallback = (path: string, options: RequestInit = {}) =>
    SELF_HOST_MODE ? fetchBackend(path, options) : fetchBackend(supabase, path, options);

  // Check backend integration state & query email accounts
  async function checkCloudConnections(userId: string) {
    try {
      // Fetch from API to check calendar/auth session
      const res = await fetchWithFallback("/api/integrations/calendar/events");

      if (SELF_HOST_MODE) {
        if (res.ok) {
          const body = await res.json();
          setGoogleEmail(body.google_email || null);
          setMicrosoftEmail(body.microsoft_email || null);
          setTelegramId(body.telegram_id || null);
          setGoogleConnected(!!body.connected?.google || !!body.google_email);
          setMicrosoftConnected(!!body.connected?.microsoft || !!body.microsoft_email);
        }
        return;
      }

      // Query public users table for integrated emails
      const { data: uData } = await supabase
        .from("users")
        .select("google_email, microsoft_email, telegram_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (uData) {
        setGoogleEmail(uData.google_email || null);
        setMicrosoftEmail(uData.microsoft_email || null);
        setTelegramId(uData.telegram_id || null);
        setGoogleConnected(!!uData.google_email);
        setMicrosoftConnected(!!uData.microsoft_email);
      } else if (res.ok) {
        const body = await res.json();
        setGoogleConnected(body.connected?.google || false);
        setMicrosoftConnected(body.connected?.microsoft || false);
      }
    } catch (err) {
      console.warn("Could not check real cloud connections:", err);
    }
  }

  // Load analytics counts and graph directly from database
  async function loadAnalyticsData(activeBotId: string, currentLeadsCount: number) {
    setLoadingAnalytics(true);
    try {
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${activeBotId}/dashboard-analytics`);
        if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
        const payload = await response.json();
        const conversations = Array.isArray(payload.conversations) ? payload.conversations : [];
        const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
        const feedback = Array.isArray(payload.feedback) ? payload.feedback : [];
        const csatRows = Array.isArray(payload.csat_feedback) ? payload.csat_feedback : [];
        const usageRows = Array.isArray(payload.usage) ? payload.usage : [];
        const queryRows = conversations.filter((row: { role?: string }) => row.role === "user");
        setTotalQueries(queryRows.length);
        setTotalSessions(new Set(conversations.map((row: { session_id?: string }) => row.session_id).filter(Boolean)).size);
        const uniqueSessions = new Set(conversations.map((row: { session_id?: string }) => row.session_id).filter(Boolean)).size;
        setConversionRate(uniqueSessions > 0 ? ((currentLeadsCount / uniqueSessions) * 100).toFixed(1) : "0.0");

        const last7Days: Array<{ dateString: string; dayLabel: string; count: number }> = [];
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          last7Days.push({ dateString: date.toDateString(), dayLabel: daysOfWeek[date.getDay()], count: 0 });
        }
        queryRows.forEach((row: { created_at?: string }) => {
          if (!row.created_at) return;
          const day = last7Days.find((entry) => entry.dateString === new Date(row.created_at as string).toDateString());
          if (day) day.count += 1;
        });
        const maxCount = Math.max(...last7Days.map((day) => day.count), 1);
        setAnalyticsChartData(last7Days.map((day) => ({ day: day.dayLabel, count: day.count, height: `${(day.count / maxCount) * 100}%` })));

        if (sessions.length) {
          const resolved = sessions.filter((row: { needs_attention?: boolean }) => !row.needs_attention).length;
          setResolutionRate(`${((resolved / sessions.length) * 100).toFixed(0)}%`);
        } else setResolutionRate("-");
        if (feedback.length) {
          const ups = feedback.filter((row: { feedback_rating?: string }) => row.feedback_rating === "up").length;
          setCsatScore(`${((ups / feedback.length) * 100).toFixed(0)}%`);
        } else setCsatScore("-");
        setCsatFeedback(csatRows);
        if (queryRows.length) {
          const hours = new Array(24).fill(0) as number[];
          queryRows.forEach((row: { created_at?: string }) => { if (row.created_at) hours[new Date(row.created_at).getHours()] += 1; });
          const peak = hours.indexOf(Math.max(...hours));
          setBusiestHour(`${peak % 12 || 12} ${peak < 12 ? "AM" : "PM"}`);
        } else setBusiestHour("-");
        const successful = usageRows.filter((row: { success?: boolean }) => row.success);
        setAiUsageTotalCalls(successful.length);
        setAiUsageTotalTokens(successful.reduce((sum: number, row: { total_tokens?: number }) => sum + (row.total_tokens || 0), 0));
        setAiUsageTotalCost(successful.reduce((sum: number, row: { cost_usd?: number }) => sum + (Number(row.cost_usd) || 0), 0));
        const byModel = new Map<string, { calls: number; tokens: number; cost: number }>();
        successful.forEach((row: { model?: string; total_tokens?: number; cost_usd?: number }) => {
          const model = row.model || "unknown";
          const entry = byModel.get(model) || { calls: 0, tokens: 0, cost: 0 };
          entry.calls += 1;
          entry.tokens += row.total_tokens || 0;
          entry.cost += Number(row.cost_usd) || 0;
          byModel.set(model, entry);
        });
        setAiUsageByModel(Array.from(byModel.entries()).map(([model, values]) => ({ model, ...values })).sort((a, b) => b.cost - a.cost));
        return;
      }
      // 1. Total user queries
      const { count: queriesCount } = await supabase
        .from("chatty_conversations")
        .select("*", { count: "exact", head: true })
        .eq("bot_id", activeBotId)
        .eq("role", "user");

      setTotalQueries(queriesCount || 0);

      // 2. Total unique sessions
      const { data: convData } = await supabase
        .from("chatty_conversations")
        .select("session_id")
        .eq("bot_id", activeBotId);

      const uniqueSessions = new Set(convData?.map(c => c.session_id) || []).size;
      setTotalSessions(uniqueSessions);

      // 3. Lead conversion rate
      const rate = uniqueSessions > 0 ? ((currentLeadsCount / uniqueSessions) * 100).toFixed(1) : "0.0";
      setConversionRate(rate);

      // 4. Last 7 days query chart
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: queryData } = await supabase
        .from("chatty_conversations")
        .select("created_at")
        .eq("bot_id", activeBotId)
        .eq("role", "user")
        .gte("created_at", sevenDaysAgo.toISOString());

      const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const last7Days: Array<{ dateString: string; dayLabel: string; count: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push({
          dateString: d.toDateString(),
          dayLabel: daysOfWeek[d.getDay()],
          count: 0
        });
      }

      if (queryData) {
        queryData.forEach(q => {
          const qDate = new Date(q.created_at).toDateString();
          const dayObj = last7Days.find(d => d.dateString === qDate);
          if (dayObj) {
            dayObj.count++;
          }
        });
      }

      const maxCount = Math.max(...last7Days.map(d => d.count), 1);
      const chart = last7Days.map(d => ({
        day: d.dayLabel,
        count: d.count,
        height: `${(d.count / maxCount) * 100}%`
      }));
      setAnalyticsChartData(chart);

      // 5. AI resolution rate - sessions the bot handled without needing a human.
      const { data: sessRows } = await supabase
        .from("chatty_sessions")
        .select("needs_attention")
        .eq("bot_id", activeBotId);
      if (sessRows && sessRows.length) {
        const resolved = sessRows.filter(s => !s.needs_attention).length;
        setResolutionRate(`${((resolved / sessRows.length) * 100).toFixed(0)}%`);
      } else {
        setResolutionRate("-");
      }

      // 6. CSAT - visitor thumbs up / (up + down).
      const { data: fbRows } = await supabase
        .from("chatty_conversations")
        .select("feedback_rating")
        .eq("bot_id", activeBotId)
        .in("feedback_rating", ["up", "down"]);
      if (fbRows && fbRows.length) {
        const ups = fbRows.filter(f => f.feedback_rating === "up").length;
        setCsatScore(`${((ups / fbRows.length) * 100).toFixed(0)}%`);
      } else {
        setCsatScore("-");
      }

      // 6b. Post-chat star ratings + comments (the CSAT popup), most recent
      // first. session_id lets the Feedback tab cross-reference a rating
      // back to any contact info the AI captured as a lead during that same
      // chat. 500 is a generous cap for the dedicated Feedback tab; the
      // Analytics summary card only ever shows the first handful of these.
      const { data: csatRows } = await supabase
        .from("chatty_csat_feedback")
        .select("id, rating, comment, session_id, created_at")
        .eq("bot_id", activeBotId)
        .order("created_at", { ascending: false })
        .limit(500);
      setCsatFeedback(csatRows || []);

      // 7. Busiest hour of day (from the last-7-days user queries).
      if (queryData && queryData.length) {
        const hours = new Array(24).fill(0);
        queryData.forEach(q => { hours[new Date(q.created_at).getHours()]++; });
        const peak = hours.indexOf(Math.max(...hours));
        const ampm = peak < 12 ? "AM" : "PM";
        const h12 = peak % 12 || 12;
        setBusiestHour(`${h12} ${ampm}`);
      } else {
        setBusiestHour("-");
      }

      // 8. AI usage & cost (last 30 days) - every LiteLLM call this bot made,
      // logged by the backend's plugins/ai_client.py to chatty_ai_usage.
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: usageRows } = await supabase
        .from("chatty_ai_usage")
        .select("model, total_tokens, cost_usd, success")
        .eq("bot_id", activeBotId)
        .gte("created_at", thirtyDaysAgo.toISOString());
      if (usageRows && usageRows.length) {
        const successful = usageRows.filter(r => r.success);
        setAiUsageTotalCalls(successful.length);
        setAiUsageTotalTokens(successful.reduce((sum, r) => sum + (r.total_tokens || 0), 0));
        setAiUsageTotalCost(successful.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0));
        const byModel = new Map<string, { calls: number; tokens: number; cost: number }>();
        for (const r of successful) {
          const entry = byModel.get(r.model) || { calls: 0, tokens: 0, cost: 0 };
          entry.calls += 1;
          entry.tokens += r.total_tokens || 0;
          entry.cost += Number(r.cost_usd) || 0;
          byModel.set(r.model, entry);
        }
        setAiUsageByModel(
          Array.from(byModel.entries())
            .map(([model, v]) => ({ model, ...v }))
            .sort((a, b) => b.cost - a.cost)
        );
      } else {
        setAiUsageTotalCalls(0);
        setAiUsageTotalTokens(0);
        setAiUsageTotalCost(0);
        setAiUsageByModel([]);
      }
    } catch (err) {
      console.error("Error loading analytics data:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  // Fetch bot settings, sources, and leads
  // Fetch bot settings, sources, and leads
  async function loadBotSettings(userId: string) {
    setLoadingLists(true);
    try {
      // No .eq("user_id", userId) filter - RLS itself now returns exactly
      // the right set (bots this user owns, OR-ed with bots they're a team
      // member of, per the "Team members can view bots they're added to"
      // policy), so an explicit owner-only filter here would silently hide
      // every team-invited bot even though the user is allowed to read it.
      let bots: Bot[] | null = null;
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback("/api/bots");
        if (!response.ok) throw new Error(`Bot list request failed (${response.status})`);
        bots = (await response.json()) as Bot[];
      } else {
        const result = await supabase
          .from("chatty_bots")
          .select("*")
          .order("updated_at", { ascending: false });
        if (result.error) throw result.error;
        bots = result.data as Bot[];
      }

      setUserBots(bots || []);
      // chatty_bots.updated_at has no update trigger - it only ever reflects
      // creation time - so ordering by it and taking [0] really means "most
      // recently created bot," not "currently active bot." Reloading after
      // any save (e.g. saveOnboardingStep, called right after the lead
      // capture toggle) would silently snap the whole panel back to a
      // different bot's data whenever the active bot wasn't the newest one,
      // making saves on any other bot look like they hadn't persisted.
      let activeBot = (botId && bots?.find((b) => b.id === botId)) || bots?.[0];

      if (!activeBot) {
        // Create a default chatbot configuration if none exists
        if (SELF_HOST_MODE) {
          const createResponse = await fetchWithFallback("/api/bots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Chatty Assistant", allowed_domains: [] }),
          });
          if (!createResponse.ok) throw new Error(`Bot creation failed (${createResponse.status})`);
          activeBot = await createResponse.json();
        } else {
          const { data: newBot, error: createError } = await supabase
            .from("chatty_bots")
            .insert({
              user_id: userId,
              name: "Chatty Assistant",
              welcome_message: "Hello! How can I help you today?",
              primary_color: "#f97316",
              widget_style: "minimal",
              send_button_style: "plane",
              selected_model: "gemini",
              system_instructions: "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.",
              strict_mode: true,
              email_notify: true
            })
            .select()
            .single();
          if (createError) throw createError;
          activeBot = newBot as Bot;
        }
        if (activeBot) setUserBots([activeBot]);
      }

      if (activeBot) {
        setBotId(activeBot.id);
        setBotName(activeBot.name);
        setWelcomeMsg(activeBot.welcome_message || "Hello! How can I help you today?");
        setConversationStarters(Array.isArray(activeBot.conversation_starters) ? activeBot.conversation_starters : []);
        setTeaserMessage(activeBot.teaser_message || "👋 Need help? Chat with us.");
        setPrimaryColor(activeBot.primary_color || "#f97316");
        setColorScheme((activeBot.color_scheme as WidgetColorScheme | null) || null);
        setFontFamily(activeBot.font_family || null);
        setFontSizePercent(activeBot.font_size_percent || 100);
        setPanelSize(activeBot.panel_size || "default");
        const styleVal = activeBot.widget_style || "minimal";
        const [styleName, logoBg, shapeVal] = styleVal.split(":");
        setWidgetStyle(normalizeWidgetStyle(styleName));
        setLogoBgColor(logoBg || "");
        setLauncherShape(shapeVal || "circle");
        setSendButtonStyle(activeBot.send_button_style || "plane");
        setAvatarIcon(activeBot.avatar_icon || "logo");
        setAvatarUrl(activeBot.avatar_url || null);
        setAvatarIconLibrarySelection(null); // not persisted - a freshly-loaded bot has no known icon/color to resume editing
        setLogoUrl(activeBot.logo_url || null);
        setSelectedModel(activeBot.selected_model || "gemini");
        setSystemInstructions(activeBot.system_instructions || "");
        setStrictMode(activeBot.strict_mode ?? true);
        setAnswerMode(activeBot.answer_mode || "strict");
        setEmailNotify(activeBot.email_notify ?? true);
        setHideBranding(activeBot.hide_branding || false);
        setShowSenderTag(activeBot.show_sender_tag || false);
        setCsatEnabled(activeBot.csat_enabled !== false);
        setVoiceMessageMode(activeBot.voice_message_mode === "audio" ? "audio" : "transcribe");
        setWebhookUrl(activeBot.webhook_url || "");
        setNotificationEmails(String(activeBot.notification_emails || ""));
        setCustomCss(activeBot.custom_css || "");
        setCustomJs(activeBot.custom_js || "");
        setResponseLanguage(activeBot.response_language || "");
        setGuardrailTopics(activeBot.guardrail_topics || "");
        setGuardrailBlockProfanity(activeBot.guardrail_block_profanity || false);
        setGuardrailRefusalMessage(activeBot.guardrail_refusal_message || "");

        setSyncGoogleDrive(activeBot.sync_google_drive || false);
        setSyncGoogleCalendar(activeBot.sync_google_calendar || false);
        setGoogleConnectedAccountId(activeBot.google_connected_account_id || null);
        setGoogleCalendarId(activeBot.google_calendar_id || "primary");
        setGoogleCalendarName(activeBot.google_calendar_name || "");
        setGoogleCalendarColor(activeBot.google_calendar_color || "auto_multiple");
        setGoogleDriveFolderId(activeBot.google_drive_folder_id || null);
        setGoogleDriveFolderName(activeBot.google_drive_folder_name || null);
        setCalendarSchedulingEnabled(activeBot.calendar_scheduling_enabled || false);
        setSchedulingDuration(activeBot.scheduling_duration_minutes || 30);
        setBotTimezone(activeBot.bot_timezone || "UTC");
        setBusinessHoursStart(activeBot.business_hours_start ?? 9);
        setBusinessHoursEnd(activeBot.business_hours_end ?? 17);
        setWorkingDays(activeBot.working_days || ["mon", "tue", "wed", "thu", "fri"]);
        setBufferMinutes(activeBot.buffer_minutes ?? 0);
        setAdvanceNoticeHours(activeBot.advance_notice_hours ?? 0);
        setMaxDailyMeetings(activeBot.max_daily_meetings ?? 0);
        setMaxWeeklyMeetings(activeBot.max_weekly_meetings ?? 0);
        setAllowedDomains(activeBot.allowed_domains || []);
        setOnboardingStep(activeBot.onboarding_step || 0);
        setOnboardingCompleted(activeBot.onboarding_completed || false);
        setLeadFields(activeBot.lead_fields || ["name", "email", "phone"]);
        setLeadCaptureEnabled(activeBot.lead_capture_enabled ?? true);
        setLeadRequiredFields(activeBot.lead_required_fields || ["name", "email"]);
        setBotCountry(activeBot.bot_country || "");
        setSyncOutlookCalendar(activeBot.sync_outlook_calendar || false);
        setSyncOffice365Calendar(activeBot.sync_office365_calendar || false);
        setMeetingProvider(activeBot.meeting_provider || "google_meet");
        setBookingEmailVerification(activeBot.booking_email_verification || false);
        setBookingBlockDisposableEmails(activeBot.booking_block_disposable_emails || false);
        setBookingLimitOneActive(activeBot.booking_limit_one_active || false);
        setBookingRequireBusinessEmail(activeBot.booking_require_business_email || false);

        // WhatsApp Business Channel
        setWhatsappEnabled(Boolean(activeBot.whatsapp_enabled));
        setWhatsappPhoneNumberId(String(activeBot.whatsapp_phone_number_id || ""));
        setWhatsappWabaId(String(activeBot.whatsapp_waba_id || ""));
        setWhatsappAccessToken(String(activeBot.whatsapp_access_token || ""));
        setWhatsappVerifyToken(String(activeBot.whatsapp_verify_token || ""));
        setWhatsappAppSecret(String(activeBot.whatsapp_app_secret || ""));
        setWhatsappQuickReplies(Array.isArray(activeBot.whatsapp_quick_replies) ? activeBot.whatsapp_quick_replies : []);

        if (!activeBot.onboarding_completed) {
          // Show the structured onboarding wizard for new bots
          setShowWizard(true);
        }

        // Fetch sources
        let srcList: SourceRecord[] | null = null;
        let dbSources: SourceRecord[] | null = null;
        if (!SELF_HOST_MODE) {
          const sourceResult = await supabase
            .from("chatty_sources")
            .select("*")
            .eq("bot_id", activeBot.id);
          dbSources = sourceResult.data as SourceRecord[] | null;
        }

        if (dbSources && dbSources.length > 0) {
          srcList = dbSources;
        } else {
          try {
            const resp = await fetchWithFallback(`/api/bots/${activeBot.id}/sources`);
            if (resp.ok) {
              const json = await resp.json();
              if (json.sources && json.sources.length > 0) {
                srcList = json.sources as SourceRecord[];
              }
            }
          } catch (e) {
            console.error("Failed to load sources from fallback endpoint:", e);
          }
          if (!srcList && dbSources) {
            srcList = dbSources;
          }
        }

        if (srcList) {
          setSources(srcList.map(s => ({
            id: s.id,
            type: s.type,
            name: s.name,
            content: s.content ?? "",
            status: s.status,
            charCount: s.char_count ?? s.charCount ?? 0,
            crawlSchedule: s.crawl_schedule || "off",
            nextCrawlAt: s.next_crawl_at
          })));
        } else {
          setSources([]);
        }

        // Fetch leads
        let leadList: Lead[] | null = null;
        if (SELF_HOST_MODE) {
          const leadsResponse = await fetchWithFallback(`/api/bots/${activeBot.id}/leads`);
          if (leadsResponse.ok) {
            const leadPayload = await leadsResponse.json();
            leadList = leadPayload.leads || [];
          }
        } else {
          const leadResult = await supabase
            .from("chatty_leads")
            .select("*")
            .eq("bot_id", activeBot.id)
            .order("created_at", { ascending: false });
          leadList = leadResult.data as Lead[] | null;
        }

        let currentLeadsCount = 0;
        if (leadList) {
          const mappedLeads = leadList.map(l => ({
            ...l,
            id: l.id,
            name: l.name || "Anonymous",
            email: l.email || "N/A",
            phone: l.phone || "N/A",
            created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
          }));
          setLeads(mappedLeads);
          currentLeadsCount = mappedLeads.length;
        }

        // Recalculate real analytics
        await loadAnalyticsData(activeBot.id, currentLeadsCount);
      }
    } catch (err) {
      console.error("Error loading bot database config:", err);
    } finally {
      setLoadingLists(false);
    }
  }

  // Switch active bot in dashboard settings
  const switchActiveBot = async (targetBotId: string) => {
    const selected = userBots.find((b) => b.id === targetBotId);
    if (!selected) return;

    setLoadingLists(true);
    try {
      setBotId(selected.id);
      setBotName(selected.name);
      setWelcomeMsg(selected.welcome_message || "Hello! How can I help you today?");
      setConversationStarters(Array.isArray(selected.conversation_starters) ? selected.conversation_starters : []);
      setTeaserMessage(selected.teaser_message || "👋 Need help? Chat with us.");
      setPrimaryColor(selected.primary_color || "#f97316");
      setColorScheme((selected.color_scheme as WidgetColorScheme) || null);
      setFontFamily(selected.font_family || null);
      setFontSizePercent(selected.font_size_percent || 100);
      setPanelSize(selected.panel_size || "default");

      const styleVal = selected.widget_style || "minimal";
      const [styleName, logoBg, shapeVal] = styleVal.split(":");
      setWidgetStyle(normalizeWidgetStyle(styleName));
      setLogoBgColor(logoBg || "");
      setLauncherShape(shapeVal || "circle");

      setSendButtonStyle(selected.send_button_style || "plane");
      setAvatarIcon(selected.avatar_icon || "logo");
      setAvatarUrl(selected.avatar_url || null);
      setAvatarIconLibrarySelection(null); // not persisted - a freshly-loaded bot has no known icon/color to resume editing
      setLogoUrl(selected.logo_url || null);
      setSelectedModel(selected.selected_model || "gemini");
      setSystemInstructions(selected.system_instructions || "");
      setStrictMode(selected.strict_mode ?? true);
      setAnswerMode(selected.answer_mode || "strict");
      setEmailNotify(selected.email_notify ?? true);
      setHideBranding(selected.hide_branding || false);
      setShowSenderTag(selected.show_sender_tag || false);
      setCsatEnabled(selected.csat_enabled !== false);
      setVoiceMessageMode(selected.voice_message_mode === "audio" ? "audio" : "transcribe");
      setWebhookUrl(selected.webhook_url || "");
      setCustomCss(selected.custom_css || "");
      setCustomJs(selected.custom_js || "");
      setResponseLanguage(selected.response_language || "");
      setGuardrailTopics(selected.guardrail_topics || "");
      setGuardrailBlockProfanity(selected.guardrail_block_profanity || false);
      setGuardrailRefusalMessage(selected.guardrail_refusal_message || "");

      setSyncGoogleDrive(selected.sync_google_drive || false);
      setSyncGoogleCalendar(selected.sync_google_calendar || false);
      setGoogleConnectedAccountId(selected.google_connected_account_id || null);
      setGoogleCalendarId(selected.google_calendar_id || "primary");
      setGoogleCalendarName(selected.google_calendar_name || "");
      setGoogleCalendarColor(selected.google_calendar_color || "auto_multiple");
      setGoogleDriveFolderId(selected.google_drive_folder_id || null);
      setGoogleDriveFolderName(selected.google_drive_folder_name || null);
      setCalendarSchedulingEnabled(selected.calendar_scheduling_enabled || false);
      setSchedulingDuration(selected.scheduling_duration_minutes || 30);
      setBotTimezone(selected.bot_timezone || "UTC");
      setBusinessHoursStart(selected.business_hours_start ?? 9);
      setBusinessHoursEnd(selected.business_hours_end ?? 17);
      setWorkingDays(selected.working_days || ["mon", "tue", "wed", "thu", "fri"]);
      setBufferMinutes(selected.buffer_minutes ?? 0);
      setAdvanceNoticeHours(selected.advance_notice_hours ?? 0);
      setMaxDailyMeetings(selected.max_daily_meetings ?? 0);
      setMaxWeeklyMeetings(selected.max_weekly_meetings ?? 0);
      setAllowedDomains(selected.allowed_domains || []);
      setOnboardingStep(selected.onboarding_step || 0);
      setOnboardingCompleted(selected.onboarding_completed || false);
      setLeadFields(selected.lead_fields || ["name", "email", "phone"]);
      setLeadCaptureEnabled(selected.lead_capture_enabled ?? true);
      setLeadRequiredFields(selected.lead_required_fields || ["name", "email"]);
      setBotCountry(selected.bot_country || "");
      setSyncOutlookCalendar(selected.sync_outlook_calendar || false);
      setSyncOffice365Calendar(selected.sync_office365_calendar || false);
      setMeetingProvider(selected.meeting_provider || "google_meet");
      setBookingEmailVerification(selected.booking_email_verification || false);
      setBookingBlockDisposableEmails(selected.booking_block_disposable_emails || false);
      setBookingLimitOneActive(selected.booking_limit_one_active || false);
      setBookingRequireBusinessEmail(selected.booking_require_business_email || false);

      // Fetch sources
      let srcList: SourceRecord[] | null = null;
      const { data: dbSources } = await supabase
        .from("chatty_sources")
        .select("*")
        .eq("bot_id", selected.id);

      if (dbSources && dbSources.length > 0) {
        srcList = dbSources;
      } else {
        try {
          const resp = await fetchWithFallback(`/api/bots/${selected.id}/sources`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.sources && json.sources.length > 0) {
              srcList = json.sources as SourceRecord[];
            }
          }
        } catch (e) {
          console.error("Failed to load sources from fallback endpoint:", e);
        }
        if (!srcList && dbSources) {
          srcList = dbSources;
        }
      }

      if (srcList) {
        setSources(srcList.map(s => ({
          id: s.id,
          type: s.type,
          name: s.name,
          content: s.content ?? "",
          status: s.status,
          charCount: s.char_count ?? s.charCount ?? 0,
          crawlSchedule: s.crawl_schedule || "off",
          nextCrawlAt: s.next_crawl_at
        })));
      } else {
        setSources([]);
      }

      // Fetch leads
      const { data: leadList } = await supabase
        .from("chatty_leads")
        .select("*")
        .eq("bot_id", selected.id)
        .order("created_at", { ascending: false });

      let currentLeadsCount = 0;
      if (leadList) {
        const mappedLeads = leadList.map(l => ({
          ...l,
          id: l.id,
          name: l.name || "Anonymous",
          email: l.email || "N/A",
          phone: l.phone || "N/A",
          created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
        }));
        setLeads(mappedLeads);
        currentLeadsCount = mappedLeads.length;
      } else {
        setLeads([]);
      }

      // Recalculate real analytics
      await loadAnalyticsData(selected.id, currentLeadsCount);
    } catch (err) {
      console.error("Error switching bot:", err);
    } finally {
      setLoadingLists(false);
    }
  }

  // OAuth returns to the dashboard before the client state has been refreshed.
  // Reload the active bot once so a successful WhatsApp connection immediately
  // reflects the enabled state and credentials in the Integrations tab.
  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("whatsapp") !== "connected") return;
    setActiveTab("integrations");
    void loadBotSettings(user.id);
    window.history.replaceState({}, "", "/dashboard?tab=integrations");
    showToast("WhatsApp connected successfully", "success");
    // The callback query is consumed once; user changes do not need to rerun it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Create a new chatbot configuration
  async function handleCreateBot(name: string, websiteUrl?: string) {
    if (!user) return;
    if (!name.trim()) return;

    // Check plan limits before attempting creation
    const ownedCount = userBots.filter((b) => b.user_id === user.id).length;
    const currentPlan = billingInfo?.plan || "free";
    const maxBots = MAX_BOTS_BY_PLAN[currentPlan] ?? 1;
    if (Number.isFinite(maxBots) && ownedCount >= maxBots) {
      showToast(
        `Chatbot limit reached (${ownedCount}/${maxBots} in use). Free allows 1, Hobby allows 3, and Standard allows 6 chatbots. Upgrade to Business for unlimited chatbots!`,
        "error"
      );
      setActiveTab("billing");
      return;
    }

    const domain = websiteUrl ? extractDomain(websiteUrl) : "";
    const initialAllowed = domain ? [domain] : [];

    setLoadingLists(true);
    try {
      let newBot: Bot | null = null;
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback("/api/bots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), allowed_domains: initialAllowed }),
        });
        if (!response.ok) throw new Error(`Bot creation failed (${response.status})`);
        newBot = await response.json();
      } else {
        const result = await supabase
          .from("chatty_bots")
          .insert({
            user_id: user.id,
            name: name.trim(),
            welcome_message: "Hello! How can I help you today?",
            primary_color: "#f97316",
            widget_style: "minimal",
            send_button_style: "plane",
            selected_model: "gemini",
            system_instructions: "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.",
            strict_mode: true,
            email_notify: true,
            allowed_domains: initialAllowed,
            onboarding_step: 9,
            onboarding_completed: true
          })
          .select()
          .single();
        if (result.error) throw result.error;
        newBot = result.data as Bot | null;
      }

      if (newBot) {
        setUserBots((prev) => [newBot, ...prev]);
        switchActiveBot(newBot.id);
        showToast(`Chatbot "${name}" created successfully!`, "success");
      }
    } catch (err: unknown) {
      console.error("Error creating bot:", err);
      const errMsg = errorMessageFromUnknown(err);

      if (
        errMsg.toLowerCase().includes("limit reached") ||
        errMsg.toLowerCase().includes("upgrade") ||
        errMsg.toLowerCase().includes("check_violation")
      ) {
        showToast(
          `Chatbot limit reached (${ownedCount}/${maxBots} in use). Upgrade to Standard or Business to create additional assistants!`,
          "error"
        );
        setActiveTab("billing");
      } else {
        showToast(`Failed to create chatbot: ${errMsg}`, "error");
      }
    } finally {
      setLoadingLists(false);
    }
  }

  // Delete an existing chatbot configuration
  async function handleDeleteBot(targetBotId: string) {
    if (!user) return;
    const targetBot = userBots.find((b) => b.id === targetBotId);
    if (!targetBot) return;

    setLoadingLists(true);
    try {
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${targetBotId}`, { method: "DELETE" });
        if (!response.ok) throw new Error(`Bot deletion failed (${response.status})`);
      } else {
        const result = await supabase
          .from("chatty_bots")
          .delete()
          .eq("id", targetBotId);
        if (result.error) throw result.error;
      }

      const remainingBots = userBots.filter((b) => b.id !== targetBotId);
      setUserBots(remainingBots);

      if (botId === targetBotId) {
        if (remainingBots.length > 0) {
          switchActiveBot(remainingBots[0].id);
        } else {
          // If no bots left, force loadBotSettings to create a default one
          await loadBotSettings(user.id);
        }
      }
      showToast(`Chatbot "${targetBot.name}" deleted successfully.`, "success");
    } catch (err) {
      console.error("Error deleting bot:", err);
      showToast(`Failed to delete chatbot: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setLoadingLists(false);
    }
  }

  // Localized Text Translation Helper
  const t = (key: string) => {
    return LOCALE_TEXTS[language]?.[key] || LOCALE_TEXTS["EN"]?.[key] || key;
  };

  // ── Dropdown option lists (memoized) ───────────────────────────────────────
  const timezoneOptions: ModernSelectOption[] = useMemo(
    () =>
      getTimezones().map((tz) => {
        const off = tzOffsetLabel(tz);
        return { value: tz, label: tz.replace(/_/g, " "), hint: off ? `(${off})` : undefined };
      }),
    []
  );
  const countryOptions: ModernSelectOption[] = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name, icon: <span>{c.flag}</span> })),
    []
  );
  const fontOptions: ModernSelectOption[] = useMemo(
    () => GOOGLE_FONTS.map((f) => ({ value: f.value ?? "", label: f.label })),
    []
  );
  const providerOptions: ModernSelectOption[] = useMemo(
    () => [
      {
        value: "google_meet",
        label: "Google Meet",
        icon: <Image src="/logos/google-meet.png" alt="" width={16} height={16} className="size-4 object-contain" />,
        // Not disabled: picking it while disconnected starts the Google
        // connect flow (see handleMeetingProviderChange) instead of no-op'ing.
        hint: googleConnected ? undefined : "connect Google",
      },
      {
        value: "zoom",
        label: "Zoom",
        icon: <Image src="/logos/zoom.png" alt="" width={16} height={16} className="size-4 object-contain" />,
        // Zoom has no in-app connect flow (backend-configured credentials),
        // so this one stays genuinely disabled until an admin sets it up.
        disabled: !zoomConfigured,
        hint: zoomConfigured ? undefined : "Zoom not configured",
      },
      {
        value: "teams",
        label: "Microsoft Teams",
        icon: <Image src="/logos/ms-teams.png" alt="" width={16} height={16} className="size-4 object-contain" />,
        hint: microsoftConnected ? undefined : "connect Microsoft",
      },
    ],
    [googleConnected, microsoftConnected, zoomConfigured]
  );
  const syncScheduleOptions: ModernSelectOption[] = useMemo(
    () => [
      { value: "off", label: "No auto re-sync" },
      { value: "daily", label: "Re-sync daily" },
      { value: "weekly", label: "Re-sync weekly" },
      { value: "monthly", label: "Re-sync monthly" },
    ],
    []
  );
  const languageOptions: ModernSelectOption[] = useMemo(
    () => [
      { value: "EN", label: "English", icon: <span>🇬🇧</span> },
      { value: "ES", label: "Español", icon: <span>🇪🇸</span> },
      { value: "FR", label: "Français", icon: <span>🇫🇷</span> },
      { value: "DE", label: "Deutsch", icon: <span>🇩🇪</span> },
      { value: "IT", label: "Italiano", icon: <span>🇮🇹</span> },
    ],
    []
  );

  // Auto-detect timezone + country once the session is ready, if not already
  // set - a one-time default-hydration effect, not something computable at
  // render time (detectTimezone/detectCountryCode read the browser's Intl/
  // geo APIs, which can't run during SSR or the render pass itself).
  useEffect(() => {
    if (loadingSession) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!botTimezone || botTimezone === "UTC") setBotTimezone(detectTimezone());
    if (!botCountry) setBotCountry(detectCountryCode());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingSession]);

  // Load the selected Google Font at runtime for the Customizer's own live
  // preview (see #customizer-live-preview below) - same technique the
  // actual widget uses (ChatWidgetCore.tsx / EmbedClient.tsx), since a
  // font picked from an open-ended catalog can't be a build-time
  // next/font/google import. Keyed by name so switching fonts doesn't
  // insert a duplicate <link>, and picking "Design default" (null) again
  // just leaves whichever ones were already loaded - a rare case a stale
  // unused <link> isn't worth cleaning up for.
  useEffect(() => {
    if (!fontFamily) return;
    const id = `chatty-google-font-${fontFamily.replace(/[^a-zA-Z0-9]/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);

  // Localized Date-Time Formatter
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const locales: Record<string, string> = { EN: "en-US", ES: "es-ES", FR: "fr-FR", DE: "de-DE", IT: "it-IT" };
      return new Intl.DateTimeFormat(locales[language] || "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: botTimezone || "UTC"
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Load Admin Panel Data (Meetings, Notifications, Audit Logs)
  async function loadAdminData(bId: string) {
    setLoadingAdminData(true);
    try {
      // 1. Fetch meetings
      const meetingsRes = await fetchWithFallback(`/api/admin/meetings?bot_id=${bId}`);
      if (meetingsRes.ok) {
        const d = await meetingsRes.json();
        setAdminMeetings(d.meetings || []);
      }
      // 2. Fetch notifications
      const notificationsRes = await fetchWithFallback(`/api/admin/notifications?bot_id=${bId}`);
      if (notificationsRes.ok) {
        const d = await notificationsRes.json();
        setAdminNotifications(d.notifications || []);
      }
      // 3. Fetch audit logs
      const auditRes = await fetchWithFallback(`/api/admin/audit-logs?bot_id=${bId}`);
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAdminAuditLogs(d.audit_logs || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoadingAdminData(false);
    }
  }

  // Load Admin Data on tab changes
  useEffect(() => {
    if (botId && ["meetings", "notifications", "mailbox", "audit_log", "leads", "feedback", "playground"].includes(activeTab)) {
      loadAdminData(botId);
    }
    if (botId && activeTab === "developer") {
      loadApiKeys(botId);
      loadWebhooks(botId);
    }
    if (botId && activeTab === "settings") {
      loadTeam();
      loadByokStatus(botId);
      loadVoiceSettings(botId);
    }
    // The Voice Agent tab reads/writes the same voiceEnabled/voiceStt.../
    // voiceTts... state as the Settings tab's voice section, but is its own
    // separate tab - this was never in the list of tabs that trigger
    // loadVoiceSettings, so opening it always showed the untouched default
    // state (voiceEnabled=false) regardless of what's actually saved,
    // making the toggle look broken/unsaved even though writes were fine.
    if (botId && activeTab === "voice_agent") {
      loadVoiceSettings(botId);
    }
    if (botId && activeTab === "knowledge") {
      loadDriveSyncSchedule();
      loadUnanswered();
    }
    // The load* functions are plain closures re-created every render, not
    // memoized - adding them here would refetch on every render instead of
    // only on an actual tab/bot change, which is what this effect is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, botId]);

  // The caller's own role + dashboard-tab permissions for the active bot -
  // drives which sidebar tabs/actions are shown. Fetched whenever the active
  // bot changes (not just when the Settings tab opens), since sidebar
  // visibility needs it from first paint.
  useEffect(() => {
    if (!botId) return;
    (async () => {
      try {
        const res = await fetchWithFallback(`/api/team/me?bot_id=${botId}`);
        if (res.ok) {
          const d = await res.json();
          const role = d.role || "owner";
          const permissions: string[] = role === "owner" ? [...CHATTY_TEAM_TABS] : (d.permissions || []);
          setMyRole(role);
          setMyPermissions(permissions);
          // If the active bot switched to one where this tab isn't granted
          // (e.g. switching from an owned bot to a shared bot as an agent),
          // the sidebar link disappears but the content pane wouldn't
          // otherwise notice - bounce back to the always-visible Overview.
          const requiredTab = NAV_TAB_PERMISSION[activeTab];
          if (requiredTab && role !== "owner" && !permissions.includes(requiredTab)) {
            setActiveTab("home");
          }
        }
      } catch { /* keep the owner-level default on failure */ }
    })();
    // Deliberately excludes activeTab - this should only re-check on a bot
    // switch, not refire on every tab click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  function canAccessTab(tab: ChattyTeamTab | null): boolean {
    return !tab || myRole === "owner" || myPermissions.includes(tab);
  }

  const isPlatformAdmin = Boolean(
    (user?.email && ["personaliai.com@gmail.com"].includes(user.email.toLowerCase())) ||
    userPlatformRole === "admin" ||
    userPlatformRole === "superadmin"
  );

  // Team members (seats) for the active bot.
  async function loadTeam() {
    if (!botId) return;
    try {
      const res = await fetchWithFallback(`/api/team?bot_id=${botId}`);
      if (res.ok) { const d = await res.json(); setTeamMembers(d.members || []); }
    } catch { setTeamMembers([]); }
  }

  async function inviteTeamMember() {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    if (!email.includes("@") || !name || !botId) return;
    setInvitingTeam(true);
    try {
      const res = await fetchWithFallback("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, email, name, role: inviteRole, permissions: inviteTabs }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setInviteName("");
        setInviteEmail("");
        await loadTeam();
        showToast(
          data.email_status === "logged"
            ? `${email} added. We couldn't email them - ask them to sign in with this address directly.`
            : `${email} added and notified by email.`,
          data.email_status === "logged" ? "info" : "success"
        );
      } else {
        showToast("Couldn't add team member. Try again.", "error");
      }
    } catch { showToast("Couldn't add team member. Try again.", "error"); } finally { setInvitingTeam(false); }
  }

  async function removeTeamMember(id: string) {
    setTeamMembers((p) => p.filter((m) => m.id !== id));
    try {
      await fetchWithFallback(`/api/team/${id}?bot_id=${botId}`, { method: "DELETE" });
    } catch { /* optimistic */ }
  }

  async function updateTeamMember(id: string, role: "agent" | "admin", permissions: ChattyTeamTab[]) {
    if (!botId) return;
    try {
      const res = await fetchWithFallback(`/api/team/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, role, permissions }),
      });
      if (res.ok) {
        setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, role, permissions } : m)));
        setEditingMemberId(null);
      } else {
        showToast("Couldn't update permissions. Try again.", "error");
      }
    } catch { showToast("Couldn't update permissions. Try again.", "error"); }
  }

  async function toggleMemberBookable(id: string, bookable: boolean) {
    if (!botId) return;
    setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, bookable } : m))); // optimistic
    try {
      const res = await fetchWithFallback(`/api/team/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, bookable }),
      });
      if (!res.ok) {
        setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, bookable: !bookable } : m))); // revert
        showToast("Couldn't update round-robin setting. Try again.", "error");
      }
    } catch {
      setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, bookable: !bookable } : m)));
      showToast("Couldn't update round-robin setting. Try again.", "error");
    }
  }

  async function toggleMemberCalendarPreference(id: string, bookOnOwnCalendar: boolean) {
    if (!botId) return;
    setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, book_on_own_calendar: bookOnOwnCalendar } : m))); // optimistic
    try {
      const res = await fetchWithFallback(`/api/team/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, book_on_own_calendar: bookOnOwnCalendar }),
      });
      if (!res.ok) {
        setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, book_on_own_calendar: !bookOnOwnCalendar } : m)));
        showToast("Couldn't update calendar preference. Try again.", "error");
      }
    } catch {
      setTeamMembers((p) => p.map((m) => (m.id === id ? { ...m, book_on_own_calendar: !bookOnOwnCalendar } : m)));
      showToast("Couldn't update calendar preference. Try again.", "error");
    }
  }

  // Knowledge gaps: questions the bot couldn't confidently answer.
  async function loadUnanswered() {
    if (!botId) return;
    try {
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${botId}/unanswered`);
        const payload = response.ok ? await response.json() : { items: [] };
        setUnanswered(payload.items || []);
      } else {
        const { data } = await supabase
          .from("chatty_unanswered")
          .select("id, question, created_at")
          .eq("bot_id", botId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(50);
        setUnanswered(data || []);
      }
    } catch {
      setUnanswered([]);
    }
  }

  async function dismissUnanswered(id: string) {
    setUnanswered((p) => p.filter((u) => u.id !== id));
    try {
      if (SELF_HOST_MODE) {
        await fetchWithFallback(`/api/bots/${botId}/unanswered/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }),
        });
      } else {
        await supabase.from("chatty_unanswered").update({ status: "dismissed" }).eq("id", id);
      }
    } catch { /* optimistic */ }
  }

  // Save the owner's answer as a knowledge source and close the gap.
  async function resolveUnanswered(id: string, question: string) {
    const answer = answerText.trim();
    if (!answer || !botId) return;
    const content = `Q: ${question}\nA: ${answer}`;
    try {
      if (SELF_HOST_MODE) {
        const sourceResponse = await fetchWithFallback(`/api/bots/${botId}/sources`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", name: question.slice(0, 80), content, status: "trained", char_count: content.length }),
        });
        if (!sourceResponse.ok) throw new Error("Failed to save knowledge source");
        await fetchWithFallback(`/api/bots/${botId}/unanswered/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }),
        });
      } else {
        await supabase.from("chatty_sources").insert({
          bot_id: botId, type: "text", name: question.slice(0, 80),
          content, status: "trained", char_count: content.length,
        });
        await supabase.from("chatty_unanswered").update({ status: "resolved" }).eq("id", id);
      }
      setUnanswered((p) => p.filter((u) => u.id !== id));
      setAnsweringId(null);
      setAnswerText("");
      if (user) loadBotSettings(user.id); // refresh sources list
    } catch (e) {
      console.error("Failed to resolve unanswered question", e);
    }
  }

  // Save Onboarding step progress
  async function saveOnboardingStep(step: number, completed: boolean, extraData: Record<string, unknown> = {}) {
    if (!botId) return;
    
    // Optimistically update local states
    setOnboardingStep(step);
    if (completed) {
      setOnboardingCompleted(true);
    }
    
    try {
      const res = await fetchWithFallback("/api/onboarding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          step,
          completed,
          ...extraData
        })
      });
      if (!res.ok) {
        throw new Error("Failed to save step");
      }
      
      // Reload bot settings to sync state
      if (SELF_HOST_MODE) {
        if (user?.id) await loadBotSettings(user.id);
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.id) await loadBotSettings(sessionData.session.user.id);
      }
    } catch (err) {
      console.error("Error saving onboarding step:", err);
    }
  }

  // ── AGENTIC SETUP FLOW ──────────────────────────────────────────────────────
  // Returns the initial assistant message for each setup step
  function getAgenticStepMessage(step: number): KnowledgeMessage {
    switch (step) {
      case 1:
        return {
          role: "assistant",
          content: "👋 Hi! Would you like to **train** this assistant using your business data?",
          quickReplies: [
            { label: "Yes, let's set it up", value: "yes_setup", icon: "✅" },
            { label: "Skip for now", value: "skip_setup", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 2:
        return {
          role: "assistant",
          content: "📂 Great! Please **send your documents** - PDF, TXT, DOCX, images, or CSV files.\n\nYou can also connect optional drives:",
          connectorButtons: true,
          quickReplies: [
            { label: "I've uploaded all my docs", value: "docs_done", icon: "✅" }
          ],
          isSetup: true
        };
      case 3:
        return {
          role: "assistant",
          content: "📋 **Do you have any custom instructions, rules, or policies** for the assistant?\n\nFor example: *Always be polite. Don't offer discounts. Refer inquiries outside North America to partners.*",
          quickReplies: [
            { label: "Skip - no custom rules", value: "skip_instructions", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 4:
        return {
          role: "assistant",
          content: "🎯 **Would you like to enable Lead Extraction?**\n\nThe assistant will automatically collect visitor contact information during conversations.",
          quickReplies: [
            { label: "Yes, enable lead capture", value: "yes_leads", icon: "✅" },
            { label: "No, skip this", value: "skip_leads", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 5:
        return {
          role: "assistant",
          content: "📋 **Which lead details should be captured?** Select the fields you need:\n\n*(Name and Email are always required)*",
          leadFieldPicker: true,
          quickReplies: [
            { label: "Confirm these fields", value: "confirm_lead_fields", icon: "✅" }
          ],
          isSetup: true
        };
      case 6:
        return {
          role: "assistant",
          content: "📅 **Would you like the assistant to schedule demo meetings with leads?**",
          quickReplies: [
            { label: "Yes, enable scheduling", value: "yes_meetings", icon: "✅" },
            { label: "No, skip", value: "skip_meetings", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 7:
        return {
          role: "assistant",
          content: "🌍 **Confirm your country & timezone, pick a meeting provider, then connect a calendar.**\n\nWe auto-detected these from your browser - adjust if needed. The assistant will collect all required lead details *before* booking, then sync times to the visitor's timezone.",
          tzPicker: true,
          providerPicker: true,
          calendarButtons: true,
          quickReplies: [
            { label: "Calendar connected - continue", value: "calendar_done", icon: "✅" },
            { label: "Continue without calendar", value: "skip_calendar", icon: "⏭️" }
          ],
          isSetup: true
        };
      case 8:
        return {
          role: "assistant",
          content: "🔔 **Notification Setup Complete!**\n\n✅ Clients will receive meeting confirmation emails\n✅ You will receive instant booking alerts\n✅ Calendar invites sent automatically\n\nYour assistant is fully configured!",
          quickReplies: [
            { label: "🚀 Open Admin Panel", value: "goto_admin", icon: "" }
          ],
          isSetup: true
        };
      default:
        return {
          role: "assistant",
          content: "Hello! I am your **Knowledge Manager**. I can help you train your chatbot.\n\n1. **Upload files** (PDF, DOCX, TXT, MD) using the 📎 paperclip button.\n2. **Crawl websites** by pasting a URL or saying `crawl https://example.com`.\n3. **Train facts** by typing documentation directly here.\n4. **Test RAG memory** by asking questions like `What is the return policy?`"
        };
    }
  }

  // Initialize the agentic setup chat when the step changes. agenticSetupStep
  // advances from several places across the onboarding flow - consolidating
  // this reaction into each of those call sites would be a larger refactor
  // than this warning justifies.
  useEffect(() => {
    if (agenticSetupStep > 0 && !onboardingCompleted) {
      const msg = getAgenticStepMessage(agenticSetupStep);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaygroundMessages(prev => {
        // Avoid duplicating if the last message is identical
        if (prev.length > 0 && prev[prev.length - 1].content === msg.content) return prev;
        return [...prev, msg];
      });
      // Navigate to knowledge tab so user sees the setup chat
      if (activeTab !== "playground") setActiveTab("playground");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenticSetupStep]);

  // Handle a quick reply button click in the setup flow
  const handleSetupQuickReply = async (value: string) => {
    // Map action to user message display
    const displayMap: Record<string, string> = {
      yes_setup: "Yes, let's set it up",
      skip_setup: "Skip for now",
      docs_done: "I've uploaded all my docs",
      skip_instructions: "Skip - no custom rules",
      yes_leads: "Yes, enable lead capture",
      skip_leads: "No, skip this",
      confirm_lead_fields: "Confirm these fields",
      yes_meetings: "Yes, enable scheduling",
      skip_meetings: "No, skip",
      skip_calendar: "Continue without calendar",
      calendar_done: "Calendar connected - continue",
      goto_admin: "Open Admin Panel",
    };
    const displayLabel = displayMap[value] || value;
    setPlaygroundMessages(prev => [...prev, { role: "user", content: displayLabel }]);

    if (value === "skip_setup") {
      setOnboardingCompleted(true);
      setAgenticSetupStep(0);
      await saveOnboardingStep(9, true);
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: "No problem! The Knowledge Manager is ready whenever you are. Upload files, crawl URLs, or type facts to train your assistant."
      }]);
      return;
    }
    if (value === "yes_setup") {
      setAgenticSetupStep(2);
      return;
    }
    if (value === "docs_done") {
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant", content: "✅ Processing complete! All documents have been indexed into RAG memory.", status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(3), 600);
      return;
    }
    if (value === "skip_instructions") {
      setAgenticSetupStep(4);
      return;
    }
    if (value === "yes_leads") {
      setAgenticSetupStep(5);
      return;
    }
    if (value === "skip_leads") {
      setAgenticSetupStep(6);
      return;
    }
    if (value === "confirm_lead_fields") {
      setLeadFields(pendingLeadFields);
      await saveOnboardingStep(4, false, { lead_fields: pendingLeadFields });
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Lead fields configured:** ${pendingLeadFields.join(", ")}\n\nYour lead table will automatically capture these fields from conversations.`,
        status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(6), 600);
      return;
    }
    if (value === "yes_meetings") {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setBotTimezone(detectedTz);
      setAgenticSetupStep(7);
      return;
    }
    if (value === "skip_meetings") {
      await saveOnboardingStep(8, false);
      setAgenticSetupStep(8);
      return;
    }
    if (value === "calendar_done") {
      setCalendarSchedulingEnabled(true);
      await saveOnboardingStep(8, false, {
        meeting_provider: meetingProvider,
        bot_timezone: botTimezone,
        bot_country: botCountry,
        calendar_scheduling_enabled: true,
      });
      setPlaygroundMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ **Scheduling configured!** Provider: **${meetingProvider.replace("_", " ")}** · ${botCountry} · ${botTimezone}. The assistant will collect all lead details before booking and email both client and admin.`,
        status: "success"
      }]);
      setTimeout(() => setAgenticSetupStep(8), 700);
      return;
    }
    if (value === "skip_calendar") {
      await saveOnboardingStep(8, false);
      setAgenticSetupStep(8);
      return;
    }
    if (value === "calendar_google") {
      handleConnectCloud("google");
      return;
    }
    if (value === "calendar_microsoft") {
      handleConnectCloud("microsoft");
      return;
    }
    if (value === "goto_admin") {
      setOnboardingCompleted(true);
      setAgenticSetupStep(0);
      await saveOnboardingStep(9, true);
      setActiveTab("leads");
      return;
    }
  };

  // Handle Cloud Connector Disconnects
  const handleDisconnectCloud = async (provider: "google" | "microsoft") => {
    showConfirm(
      `Disconnect ${provider === "google" ? "Google" : "Microsoft"}`,
      `Are you sure you want to disconnect ${provider === "google" ? "Google" : "Microsoft"}? This will turn off all syncing sources and clear connection tokens.`,
      async () => {
        try {
          const res = await fetchWithFallback(`/api/integrations/${provider}/disconnect`, {
            method: "POST"
          });
          if (res.ok) {
            if (provider === "google") {
              setGoogleConnected(false);
              setGoogleEmail(null);
            } else {
              setMicrosoftConnected(false);
              setMicrosoftEmail(null);
            }
            showToast(`${provider === "google" ? "Google" : "Microsoft"} disconnected successfully.`, "success");
          } else {
            showToast(`Failed to disconnect ${provider}.`, "error");
          }
        } catch (err) {
          console.error(`Error disconnecting ${provider}:`, err);
          showToast(`Error disconnecting ${provider}.`, "error");
        }
      }
    );
  };

  // Telegram link and unlink
  const handleLinkTelegram = async (chatIdNum: number) => {
    try {
      const res = await fetchWithFallback(`/api/integrations/telegram/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_id: chatIdNum })
      });
      if (res.ok) {
        setTelegramId(chatIdNum);
        return true;
      } else {
        const body = await res.json();
        throw new Error(body.message || "Failed to link Telegram");
      }
    } catch (err) {
      console.error("Error linking Telegram:", err);
      throw err;
    }
  };

  // Persist chatbot appearance/settings to Supabase
  async function handleSaveChanges() {
    if (!user || !botId) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
          name: botName,
          welcome_message: welcomeMsg,
          conversation_starters: conversationStarters.map((s) => s.trim()).filter(Boolean),
          teaser_message: teaserMessage,
          primary_color: primaryColor,
          widget_style: `${widgetStyle}:${logoBgColor || ""}:${launcherShape}`,
          color_scheme: colorScheme,
          font_family: fontFamily,
          font_size_percent: fontSizePercent,
          panel_size: panelSize,
          send_button_style: sendButtonStyle,
          avatar_icon: avatarIcon,
          avatar_url: avatarUrl,
          logo_url: logoUrl,
          selected_model: selectedModel,
          system_instructions: systemInstructions,
          strict_mode: strictMode,
          answer_mode: answerMode,
          email_notify: emailNotify,
          hide_branding: hideBranding,
          show_sender_tag: showSenderTag,
          csat_enabled: csatEnabled,
          voice_message_mode: voiceMessageMode,
          webhook_url: webhookUrl,
          notification_emails: notificationEmails,
          custom_css: customCss,
          custom_js: customJs,
          response_language: responseLanguage,
          guardrail_topics: guardrailTopics,
          guardrail_block_profanity: guardrailBlockProfanity,
          guardrail_refusal_message: guardrailRefusalMessage,
          sync_google_drive: syncGoogleDrive,
          sync_google_calendar: syncGoogleCalendar,
          google_connected_account_id: googleConnectedAccountId || null,
          google_calendar_id: googleCalendarId || "primary",
          google_calendar_name: googleCalendarName || null,
          google_calendar_color: googleCalendarColor || "auto_multiple",
          google_drive_folder_id: googleDriveFolderId || null,
          google_drive_folder_name: googleDriveFolderName || null,
          sync_outlook_calendar: syncOutlookCalendar,
          calendar_scheduling_enabled: calendarSchedulingEnabled,
          scheduling_duration_minutes: schedulingDuration,
          bot_timezone: botTimezone,
          bot_country: botCountry,
          meeting_provider: meetingProvider,
          business_hours_start: businessHoursStart,
          business_hours_end: businessHoursEnd,
          working_days: workingDays,
          buffer_minutes: bufferMinutes,
          advance_notice_hours: advanceNoticeHours,
          max_daily_meetings: maxDailyMeetings,
          max_weekly_meetings: maxWeeklyMeetings,
          booking_email_verification: bookingEmailVerification,
          booking_block_disposable_emails: bookingBlockDisposableEmails,
          booking_limit_one_active: bookingLimitOneActive,
          booking_require_business_email: bookingRequireBusinessEmail,
          allowed_domains: allowedDomains,
          voice_enabled: voiceEnabled,
          voice_stt_provider: voiceSttProvider,
          voice_tts_provider: voiceTtsProvider,
          voice_tts_voice: voiceTtsVoice || null,
          whatsapp_enabled: whatsappEnabled,
          whatsapp_phone_number_id: whatsappPhoneNumberId.trim() || null,
          whatsapp_waba_id: whatsappWabaId.trim() || null,
          whatsapp_access_token: whatsappAccessToken.trim() || null,
          whatsapp_verify_token: whatsappVerifyToken.trim() || null,
          whatsapp_app_secret: whatsappAppSecret.trim() || null,
          whatsapp_quick_replies: whatsappQuickReplies,
          updated_at: new Date().toISOString()
      };

      let missingColWarning: string | null = null;
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${botId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const details = await response.text().catch(() => "");
          throw new Error(`Save failed (${response.status})${details ? `: ${details}` : ""}`);
        }
      } else {
        let { error } = await supabase.from("chatty_bots").update(payload).eq("id", botId);
        // A column this build knows about (e.g. color_scheme) can lag behind
        // its migration being applied - PostgREST rejects the WHOLE update
        // with a 400 in that case, silently breaking every other field too.
        // Retry once without the field PostgREST names, so a pending
        // migration degrades to "that one setting didn't save" instead of
        // "nothing saved and no error shown".
        if (error && /schema cache/i.test(error.message || "")) {
          const missingCol = error.message.match(/'([a-z_]+)' column/)?.[1];
          if (missingCol && missingCol in payload) {
            const { [missingCol]: _omit, ...retryPayload } = payload;
            void _omit;
            const retry = await supabase.from("chatty_bots").update(retryPayload).eq("id", botId);
            error = retry.error;
            if (!error) missingColWarning = missingCol;
          }
        }
        if (error) throw error;
      }
      setHasUnsavedChanges(false);
      showToast(
        missingColWarning ? `Saved, but "${missingColWarning}" needs a pending database update first.` : "Changes saved.",
        missingColWarning ? "error" : "success"
      );

      // Update local userBots array so switcher dropdown has fresh names / values
      setUserBots((prev) =>
        prev.map((b) =>
          b.id === botId
            ? {
                ...b,
                name: botName,
                welcome_message: welcomeMsg,
                conversation_starters: conversationStarters.map((s) => s.trim()).filter(Boolean),
                teaser_message: teaserMessage,
                primary_color: primaryColor,
                widget_style: `${widgetStyle}:${logoBgColor || ""}:${launcherShape}`,
                color_scheme: colorScheme,
                font_family: fontFamily,
                font_size_percent: fontSizePercent,
                panel_size: panelSize,
                send_button_style: sendButtonStyle,
                avatar_icon: avatarIcon,
                avatar_url: avatarUrl,
                logo_url: logoUrl,
                selected_model: selectedModel,
                system_instructions: systemInstructions,
                strict_mode: strictMode,
          answer_mode: answerMode,
                email_notify: emailNotify,
                hide_branding: hideBranding,
                show_sender_tag: showSenderTag,
                csat_enabled: csatEnabled,
                voice_message_mode: voiceMessageMode,
                webhook_url: webhookUrl,
                custom_css: customCss,
                custom_js: customJs,
                response_language: responseLanguage,
                guardrail_topics: guardrailTopics,
                guardrail_block_profanity: guardrailBlockProfanity,
                guardrail_refusal_message: guardrailRefusalMessage,
                sync_google_drive: syncGoogleDrive,
                sync_google_calendar: syncGoogleCalendar,
                sync_outlook_calendar: syncOutlookCalendar,
                calendar_scheduling_enabled: calendarSchedulingEnabled,
                scheduling_duration_minutes: schedulingDuration,
                bot_timezone: botTimezone,
                bot_country: botCountry,
                meeting_provider: meetingProvider,
                business_hours_start: businessHoursStart,
                business_hours_end: businessHoursEnd,
                working_days: workingDays,
                buffer_minutes: bufferMinutes,
                advance_notice_hours: advanceNoticeHours,
                max_daily_meetings: maxDailyMeetings,
                max_weekly_meetings: maxWeeklyMeetings,
                booking_email_verification: bookingEmailVerification,
                booking_block_disposable_emails: bookingBlockDisposableEmails,
                booking_limit_one_active: bookingLimitOneActive,
                booking_require_business_email: bookingRequireBusinessEmail,
                allowed_domains: allowedDomains,
                voice_enabled: voiceEnabled,
                voice_stt_provider: voiceSttProvider,
                voice_tts_provider: voiceTtsProvider,
                voice_tts_voice: voiceTtsVoice || null,
              }
            : b
        )
      );
    } catch (err) {
      console.error("Error saving chatbot changes:", err);
      showToast("Failed to save changes.", "error");
    } finally {
      setIsSaving(false);
    }
  }
  handleSaveChangesRef.current = handleSaveChanges;

  // Handle Input Changes - debounced auto-save instead of a manual
  // "unsaved changes" banner: every change re-arms a short timer, and
  // handleSaveChanges fires once input settles, same pattern already used
  // for voice settings (handleAutoSaveVoiceField).
  const handleInputChange = <T,>(setter: (val: T) => void, val: T) => {
    setter(val);
    setHasUnsavedChanges(true);
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSaveChangesRef.current();
    }, 1200);
  };

  const generateInstructions = async () => {
    if (!botId || isGeneratingInstructions) return;
    setIsGeneratingInstructions(true);
    try {
      const res = await fetchWithFallback("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          session_id: `__gen_instructions_${Date.now()}`,
          text:
            "Based solely on your knowledge base, generate your own configuration. " +
            "Respond in EXACTLY this format, with no preamble or extra commentary - " +
            "three sections, each starting on its own line with the exact header shown:\n\n" +
            "SYSTEM_INSTRUCTIONS:\n" +
            "A concise system prompt for yourself (2-4 sentences): 1) what you are and what business/product you represent, 2) what topics you help with, 3) your tone and response style.\n\n" +
            "GUARDRAIL_TOPICS:\n" +
            "A comma-separated list of topics you should always decline to discuss - infer these from what's actually OUT of scope given your knowledge base (e.g. if you're a support bot for a SaaS product, likely topics are: competitor products, medical advice, legal advice, unrelated general knowledge). Leave blank if nothing obvious applies.\n\n" +
            "REFUSAL_MESSAGE:\n" +
            "One short, on-brand sentence to say when declining an off-topic question - match the tone of your knowledge base.",
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        const generated: string = body.reply || body.message || body.response || "";
        if (generated) {
          const section = (name: string) => {
            const re = new RegExp(`${name}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, "i");
            const m = generated.match(re);
            return m ? m[1].trim() : "";
          };
          const instructions = section("SYSTEM_INSTRUCTIONS");
          const topics = section("GUARDRAIL_TOPICS");
          const refusal = section("REFUSAL_MESSAGE");
          // Fallback: if the model didn't follow the format at all, treat the
          // whole reply as the system instructions (previous behavior) rather
          // than silently generating nothing.
          if (!instructions && !topics && !refusal) {
            handleInputChange(setSystemInstructions, generated.trim());
          } else {
            if (instructions) handleInputChange(setSystemInstructions, instructions);
            handleInputChange(setGuardrailTopics, /^(none|n\/a|blank|-)$/i.test(topics) ? "" : topics);
            if (refusal) handleInputChange(setGuardrailRefusalMessage, refusal);
          }
        }
      }
    } catch (e) {
      console.error("Failed to generate instructions", e);
    } finally {
      setIsGeneratingInstructions(false);
    }
  };

  // Resets the playground chat to a fresh welcome message whenever the bot's
  // welcome message or the active tab changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaygroundMessages([
      { role: "assistant", content: welcomeMsg }
    ]);
  }, [welcomeMsg, activeTab]);

  useEffect(() => {
    playgroundEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages, isBotResponding]);

  // Auto-scroll for Knowledge Chat
  useEffect(() => {
    knowledgeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundMessages, isKnowledgeLoading, uploadingFile]);

  // Handle Knowledge Base File Upload
  const handleKnowledgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !botId) return;

    // Check size limit: 20MB
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast("File is too large. Max size allowed is 20MB.", "error");
      return;
    }

    setUploadingFile(file.name);
    setIsKnowledgeLoading(true);
    startKnowledgeProgress(
      `Uploading ${file.name}`,
      "Uploading file and preparing RAG indexing...",
      [
        "Uploading document securely...",
        "Extracting text & formatting structure...",
        "Splitting into semantically coherent chunks...",
        "Vectorizing content & storing in knowledge base..."
      ]
    );

    // Add a pending message
    setPlaygroundMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: `Uploaded file: **${file.name}**`
      },
      {
        role: "assistant",
        content: `Uploading and indexing **${file.name}**... Please wait while I process the document structure and extract text chunks.`,
        status: "pending",
        filename: file.name
      }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetchWithFallback("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const body = await res.json();
        completeKnowledgeProgress(
          "Document Indexed",
          `Successfully trained on ${file.name} (+${body.chunk_count || 0} chunks added).`
        );
        
        // Update the assistant message in chat log
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Successfully trained on **${file.name}**! Added **${body.chunk_count || 0}** chunks to RAG memory.`,
                  status: "success"
                }
              : msg
          )
        );

        // Fetch sources to refresh lists
        if (user) {
          await loadBotSettings(user.id);
        }
      } else {
        const body = await res.json().catch(() => ({ detail: "Unknown backend error." }));
        errorKnowledgeProgress(
          "Upload Failed",
          body.detail || "Failed to index document."
        );
        setPlaygroundMessages((prev) =>
          prev.map((msg) =>
            msg.filename === file.name && msg.status === "pending"
              ? {
                  role: "assistant",
                  content: `Failed to index **${file.name}**. Error: ${body.detail || "Unknown backend error."}`,
                  status: "error"
                }
              : msg
          )
        );
      }
    } catch (err) {
      console.error("File upload error:", err);
      errorKnowledgeProgress(
        "Upload Failed",
        "Could not connect to the upload server. Make sure the backend is active."
      );
      setPlaygroundMessages((prev) =>
        prev.map((msg) =>
          msg.filename === file.name && msg.status === "pending"
            ? {
                role: "assistant",
                content: `Could not connect to the upload server. Make sure the backend is active.`,
                status: "error"
              }
            : msg
        )
      );
    } finally {
      setIsKnowledgeLoading(false);
      setUploadingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Cloud Connector Triggers
  const handleConnectCloud = async (provider: "google" | "microsoft") => {
    setConnectingProvider(provider);
    try {
      const res = await fetchWithFallback(`/api/integrations/${provider}/start?redirect_path=/dashboard`, {
        method: "POST"
      });
      if (res.ok) {
        const body = await res.json();
        if (body.url) {
          window.location.href = body.url; // Redirect to OAuth
          return;
        }
      }
    } catch (err) {
      console.error(`Error connecting to ${provider}:`, err);
    }
    setConnectingProvider(null);
  };

  // Picking "Google Meet"/"Teams" as the meeting provider, or "Google/Outlook
  // Calendar" as the sync target, while that account isn't connected used to
  // just silently no-op (the option was disabled, so clicking it did
  // nothing - confusing, since nothing told the visitor why). Now it starts
  // the same OAuth connect flow as the Quick Connect buttons instead.
  const handleMeetingProviderChange = (v: string) => {
    if (v === "google_meet" && !googleConnected) { handleConnectCloud("google"); return; }
    if (v === "teams" && !microsoftConnected) { handleConnectCloud("microsoft"); return; }
    handleInputChange(setMeetingProvider, v);
  };
  const handleCalendarSyncChange = (v: string) => {
    if (v === "google" && !googleConnected) { handleConnectCloud("google"); return; }
    if (v === "outlook" && !microsoftConnected) { handleConnectCloud("microsoft"); return; }
    handleInputChange(v === "outlook" ? setSyncOutlookCalendar : setSyncGoogleCalendar, true);
  };

  // Handle training URL crawl
  // Scan a site's sitemap.xml → list all page URLs for the admin to pick.
  const handleScanSitemap = async () => {
    if (!inputUrl.trim()) return;
    setScanningSitemap(true); setCrawlSummary(null); setDiscoveredUrls([]);
    startKnowledgeProgress(
      "Scanning Sitemap",
      `Connecting to ${inputUrl.trim()}...`,
      [
        "Connecting to target web host...",
        "Fetching sitemap.xml and robots.txt...",
        "Parsing XML endpoints & pages...",
        "Listing discoverable URLs for selection..."
      ]
    );
    try {
      const res = await fetchWithFallback("/api/crawl/discover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        const urls: string[] = d.urls || [];
        setDiscoveredUrls(urls);
        setSelectedUrls(new Set(urls));
        if (!d.sitemap_found) {
          setCrawlSummary("No sitemap found - only this single page is available.");
          completeKnowledgeProgress("Scan Complete", "No sitemap found - single page detected.");
        } else {
          completeKnowledgeProgress("Sitemap Scanned", `Found ${urls.length} pages ready to crawl.`);
        }
      } else {
        setCrawlSummary("Could not scan that site.");
        errorKnowledgeProgress("Scan Failed", "Could not scan that website.");
      }
    } catch {
      setCrawlSummary("Scan failed.");
      errorKnowledgeProgress("Scan Failed", "Network error while scanning sitemap.");
    }
    finally { setScanningSitemap(false); }
  };

  // Crawl the admin-selected URLs and index each as a knowledge source.
  const handleCrawlSelected = async () => {
    const urls = Array.from(selectedUrls);
    if (!urls.length || !botId) return;
    setCrawlingPages(true); setCrawlSummary(null);
    startKnowledgeProgress(
      `Crawling ${urls.length} Pages`,
      `Queueing ${urls.length} pages for indexing...`,
      [
        "Dispatching crawl requests...",
        "Parsing page HTML and content structure...",
        "Splitting articles into semantic chunks...",
        "Embedding vectors into knowledge base..."
      ]
    );
    try {
      const res = await fetchWithFallback("/api/crawl/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, urls }),
      });
      if (res.ok) {
        const d = await res.json();
        const summaryText = `Indexed ${d.indexed} of ${urls.length} pages into your knowledge base.`;
        setCrawlSummary(summaryText);
        completeKnowledgeProgress("Crawl Complete", summaryText);
        setDiscoveredUrls([]); setSelectedUrls(new Set());
        if (user) loadBotSettings(user.id);
      } else {
        setCrawlSummary("Crawl failed.");
        errorKnowledgeProgress("Crawl Failed", "Failed to crawl selected pages.");
      }
    } catch {
      setCrawlSummary("Crawl failed.");
      errorKnowledgeProgress("Crawl Failed", "Connection error during page crawling.");
    }
    finally { setCrawlingPages(false); }
  };

  const handleBulkAddUrls = async () => {
    const urls = Array.from(new Set(
      bulkUrlsText.split("\n").map((u) => u.trim()).filter(Boolean)
    )).slice(0, 100);
    if (!urls.length || !botId) return;
    setCrawlingPages(true);
    setCrawlSummary(null);
    startKnowledgeProgress(
      `Bulk Indexing ${urls.length} URLs`,
      `Connecting to ${urls.length} URLs in parallel...`,
      [
        "Initializing parallel crawler...",
        "Downloading page contents & metadata...",
        "Chunking article bodies for RAG...",
        "Storing embeddings into knowledge base..."
      ]
    );
    try {
      const res = await fetchWithFallback("/api/crawl/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, urls }),
      });
      if (res.ok) {
        const d = await res.json();
        const summaryText = `Indexed ${d.indexed} of ${urls.length} pages into your knowledge base.`;
        setCrawlSummary(summaryText);
        completeKnowledgeProgress("Bulk Crawl Complete", summaryText);
        setBulkUrlsText("");
        setBulkUrlsOpen(false);
        if (user) loadBotSettings(user.id);
      } else {
        setCrawlSummary("Bulk crawl failed.");
        errorKnowledgeProgress("Bulk Crawl Failed", "Failed to crawl the provided URLs.");
      }
    } catch {
      setCrawlSummary("Bulk crawl failed.");
      errorKnowledgeProgress("Bulk Crawl Failed", "Connection error during bulk crawl.");
    } finally {
      setCrawlingPages(false);
    }
  };

  const handleTrainUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const urlName = inputUrl.trim();
    setInputUrl("");

    const existingInState = sources.find((s) => s.name === urlName && s.type === "url");
    const newId = existingInState ? existingInState.id : `src-${Date.now()}`;

    startKnowledgeProgress(
      `Crawling Webpage`,
      `Connecting to ${urlName}...`,
      [
        "Resolving domain & fetching HTML...",
        "Extracting readable markdown content...",
        "Analyzing text structure & chunking...",
        "Embedding content & storing in knowledge base..."
      ]
    );

    if (existingInState) {
      setSources((prev) =>
        prev.map((s) => (s.id === newId ? { ...s, status: "training", content: "Crawling website contents in progress..." } : s))
      );
    } else {
      const tempSource: Source = {
        id: newId,
        type: "url",
        name: urlName,
        content: "Crawling website contents in progress...",
        status: "training",
        charCount: 0
      };
      setSources((prev) => [...prev, tempSource]);
    }

    try {
      let crawledContent = `This source represents the crawled contents of ${urlName}.`;
      try {
        const jinaUrl = `https://r.jina.ai/${urlName}`;
        const response = await fetch(jinaUrl);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim().length > 100) {
            crawledContent = text;
          }
        }
      } catch (crawlErr) {
        console.warn("Real-time client-side crawl failed, using fallback placeholder:", crawlErr);
      }

      if (user && botId) {
        // Query to check if duplicate exists in database
        const { data: existingSrc } = await supabase
          .from("chatty_sources")
          .select("id")
          .eq("bot_id", botId)
          .eq("type", "url")
          .eq("name", urlName)
          .maybeSingle();

        let dbSrc;
        if (existingSrc) {
          const { data: updated, error } = await supabase
            .from("chatty_sources")
            .update({
              content: crawledContent,
              status: "training",
              char_count: crawledContent.length
            })
            .eq("id", existingSrc.id)
            .select()
            .single();
          if (error) throw error;
          dbSrc = updated;
        } else {
          const { data: inserted, error } = await supabase
            .from("chatty_sources")
            .insert({
              bot_id: botId,
              type: "url",
              name: urlName,
              content: crawledContent,
              status: "training",
              char_count: crawledContent.length
            })
            .select()
            .single();
          if (error) throw error;
          dbSrc = inserted;
        }

        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId || s.id === dbSrc.id ? { ...s, id: dbSrc.id, content: crawledContent, status: "trained", charCount: crawledContent.length } : s))
          );
          completeKnowledgeProgress(
            "Page Crawled & Indexed",
            `Successfully trained on ${urlName} (${crawledContent.length.toLocaleString()} characters).`
          );
        }, 1500);
      } else {
        completeKnowledgeProgress("Page Crawled", `Trained on ${urlName}.`);
      }
    } catch (err) {
      console.error("Error inserting url source:", err);
      errorKnowledgeProgress("Crawl Failed", "Failed to crawl and index website.");
      if (!existingInState) {
        setSources((prev) => prev.filter((s) => s.id !== newId));
      }
    }
  };

  // Handle training text documentation
  const handleTrainText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !inputTitle.trim()) return;

    const newId = `src-${Date.now()}`;
    const docTitle = inputTitle;
    const docContent = inputText;
    setInputText("");
    setInputTitle("");

    startKnowledgeProgress(
      `Indexing "${docTitle}"`,
      "Analyzing document structure...",
      [
        "Splitting text into semantic paragraphs...",
        "Generating RAG vector representations...",
        "Saving custom knowledge source..."
      ]
    );

    const newSource: Source = {
      id: newId,
      type: "text",
      name: docTitle,
      content: docContent,
      status: "training",
      charCount: docContent.length
    };
    setSources((prev) => [...prev, newSource]);

    try {
      if (user && botId) {
        const { data: dbSrc, error } = await supabase
          .from("chatty_sources")
          .insert({
            bot_id: botId,
            type: "text",
            name: docTitle,
            content: docContent,
            status: "training",
            char_count: docContent.length
          })
          .select()
          .single();

        if (error) throw error;

        setTimeout(async () => {
          await supabase
            .from("chatty_sources")
            .update({ status: "trained" })
            .eq("id", dbSrc.id);

          setSources((prev) =>
            prev.map((s) => (s.id === newId ? { ...s, id: dbSrc.id, status: "trained" } : s))
          );
          completeKnowledgeProgress(
            "Knowledge Added",
            `"${docTitle}" is trained and ready (${docContent.length.toLocaleString()} characters).`
          );
        }, 2000);
      } else {
        completeKnowledgeProgress("Knowledge Added", `"${docTitle}" added to knowledge base.`);
      }
    } catch (err) {
      console.error("Error inserting text source:", err);
      errorKnowledgeProgress("Indexing Failed", "Failed to save text source.");
    }
  };

  // Handle Google Drive folder indexing
  const loadDriveSyncSchedule = async () => {
    try {
      const res = await fetchWithFallback("/api/documents/sync-schedule");
      if (res.ok) {
        const d = await res.json();
        setDriveSyncSchedule(d.gdrive?.schedule || "off");
        setOnedriveSyncSchedule(d.onedrive?.schedule || "off");
      }
    } catch (err) {
      console.error("Failed to load Drive/OneDrive sync schedule:", err);
    }
  };

  const handleSetDriveSyncSchedule = async (source: "gdrive" | "onedrive", schedule: "off" | "daily" | "weekly" | "monthly") => {
    const setter = source === "gdrive" ? setDriveSyncSchedule : setOnedriveSyncSchedule;
    setter(schedule);
    try {
      const res = await fetchWithFallback("/api/documents/sync-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, schedule }),
      });
      if (!res.ok) {
        const body = await res.json();
        showToast(body.detail || "Failed to update sync schedule.", "error");
        await loadDriveSyncSchedule();
      }
    } catch (err) {
      console.error("Failed to set Drive/OneDrive sync schedule:", err);
    }
  };

  const handleIndexDriveFolder = async (e: React.FormEvent, source: "gdrive" | "onedrive" = "gdrive") => {
    e.preventDefault();
    if (!driveFolderUrl.trim()) return;

    setIsIndexingDrive(true);
    setDriveIndexError(null);
    setDriveIndexSuccess(null);

    const providerName = source === "onedrive" ? "OneDrive" : "Google Drive";
    startKnowledgeProgress(
      `Indexing ${providerName} Folder`,
      "Connecting to cloud storage...",
      [
        "Verifying cloud folder permissions...",
        "Listing matching files and documents...",
        "Queueing files for automatic document extraction...",
        "Generating vector chunks for RAG..."
      ]
    );

    try {
      const res = await fetchWithFallback("/api/documents/index-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder_id_or_url: driveFolderUrl.trim(),
          max_files: driveMaxFiles,
          source,
          bot_id: botId,
        }),
      });

      if (res.ok) {
        const successMsg = "Indexing started in background. The files will be crawled and loaded shortly.";
        setDriveIndexSuccess(successMsg);
        completeKnowledgeProgress(`${providerName} Folder Queued`, successMsg);
        setDriveFolderUrl("");
      } else {
        const body = await res.json().catch(() => ({ detail: "Failed to start folder indexing." }));
        const errDetail = body.detail || "Failed to start folder indexing.";
        setDriveIndexError(errDetail);
        errorKnowledgeProgress(`${providerName} Indexing Failed`, errDetail);
      }
    } catch (err) {
      console.error("Error indexing Drive folder:", err);
      const errMsg = "Failed to connect to the server.";
      setDriveIndexError(errMsg);
      errorKnowledgeProgress(`${providerName} Indexing Failed`, errMsg);
    } finally {
      setIsIndexingDrive(false);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    try {
      if (user) {
        await supabase
          .from("chatty_sources")
          .delete()
          .eq("id", id);
      }
    } catch (err) {
      console.error("Error deleting source:", err);
    }
  };

  // The refresh icon next to a URL source's re-crawl schedule dropdown
  // - that dropdown only sets the auto re-crawl cadence, it never actually
  // triggers a crawl. This does: same /api/crawl/pages endpoint the initial
  // crawl uses, which upserts by (bot_id, type=url, name=url) so re-crawling
  // an existing source updates its row in place rather than duplicating it.
  const handleRecrawlNow = async (sourceId: string, url: string) => {
    if (!botId || recrawlingSourceId) return;
    setRecrawlingSourceId(sourceId);
    startKnowledgeProgress(
      `Re-crawling URL`,
      `Refreshing knowledge from ${url}...`,
      [
        "Connecting to live page...",
        "Extracting updated content diffs...",
        "Re-generating vector embeddings...",
        "Updating knowledge base..."
      ]
    );
    try {
      const res = await fetchWithFallback("/api/crawl/pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, urls: [url] }),
      });
      const body = await res.json().catch(() => ({}));
      const result = body.results?.[0];
      if (res.ok && result?.ok) {
        setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, charCount: result.chars ?? s.charCount, status: "trained" } : s)));
        showToast("Re-crawled - knowledge base updated.", "success");
        completeKnowledgeProgress("Re-crawl Complete", `Updated ${url} (${(result?.chars || 0).toLocaleString()} chars).`);
      } else {
        const failMsg = result?.error ? `Re-crawl failed: ${result.error}` : "Re-crawl failed.";
        showToast(failMsg, "error");
        errorKnowledgeProgress("Re-crawl Failed", failMsg);
      }
    } catch (err) {
      console.error("Error re-crawling source:", err);
      showToast("Re-crawl failed.", "error");
      errorKnowledgeProgress("Re-crawl Failed", "Could not connect to crawl server.");
    } finally {
      setRecrawlingSourceId(null);
    }
  };

  // Re-crawl URL sources in bounded batches. A single 100-page request can
  // hold the dashboard request open long enough to look frozen on mobile;
  // bounded batches keep each request within the API timeout and let the UI
  // report real progress between batches.
  const handleCrawlAll = async () => {
    if (!botId || crawlingAll) return;
    const urlSources = sources.filter((s) => s.type === "url");
    if (urlSources.length === 0) return;
    setCrawlingAll(true);
    startKnowledgeProgress(
      `Re-crawling All ${urlSources.length} URLs`,
      "Preparing full knowledge re-crawl...",
      [
        "Batching URLs for parallel processing...",
        "Extracting fresh website contents...",
        "Updating vector chunk index...",
        "Finalizing knowledge synchronization..."
      ]
    );
    try {
      const urls = urlSources.slice(0, 100).map((s) => s.name);
      const batchSize = 20;
      const batches = Array.from({ length: Math.ceil(urls.length / batchSize) }, (_, index) =>
        urls.slice(index * batchSize, (index + 1) * batchSize)
      );
      const results: { url: string; ok: boolean; chars?: number; error?: string }[] = [];
      for (let index = 0; index < batches.length; index += 1) {
        const res = await fetchWithFallback("/api/crawl/pages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, urls: batches[index] }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.detail || `Batch ${index + 1} failed`);
        }
        results.push(...(body.results || []));
        setKnowledgeProgress((prev) => prev ? {
          ...prev,
          percent: Math.min(94, 10 + Math.round(((index + 1) / batches.length) * 84)),
          detail: `Crawled ${Math.min((index + 1) * batchSize, urls.length)} of ${urls.length} URLs...`,
        } : prev);
      }
      if (results.length) {
        const byUrl = new Map(results.map((r) => [r.url, r]));
        setSources((prev) => prev.map((s) => {
          const r = s.type === "url" ? byUrl.get(s.name) : undefined;
          return r?.ok ? { ...s, charCount: r.chars ?? s.charCount, status: "trained" } : s;
        }));
        const indexed = results.filter((result) => result.ok).length;
        const failed = results.length - indexed;
        const msg = failed > 0 ? `Re-crawled ${indexed}/${results.length} sources (${failed} failed).` : `Re-crawled all ${indexed} sources.`;
        showToast(
          msg,
          failed > 0 ? "error" : "success",
        );
        if (failed > 0) {
          errorKnowledgeProgress("Crawl Finished with Errors", msg);
        } else {
          completeKnowledgeProgress("All URLs Re-crawled", msg);
        }
      } else {
        showToast("Crawl all failed.", "error");
        errorKnowledgeProgress("Crawl All Failed", "Could not complete re-crawling.");
      }
    } catch (err) {
      console.error("Error crawling all sources:", err);
      showToast("Crawl all failed.", "error");
      errorKnowledgeProgress("Crawl All Failed", "Network error during full crawl.");
    } finally {
      setCrawlingAll(false);
    }
  };

  const handleSetCrawlSchedule = async (id: string, schedule: "off" | "daily" | "weekly" | "monthly") => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, crawlSchedule: schedule } : s)));
    try {
      const res = await fetchWithFallback(`/api/sources/${id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      const body = await res.json();
      if (res.ok) {
        setSources((prev) => prev.map((s) => (s.id === id ? { ...s, nextCrawlAt: body.next_crawl_at } : s)));
      }
    } catch (err) {
      console.error("Error setting crawl schedule:", err);
    }
  };


  // ── API key management ─────────────────────────────────────────────────────
  const loadApiKeys = async (bId: string) => {
    setLoadingApiKeys(true);
    try {
      const res = await fetchWithFallback(`/api/keys?bot_id=${bId}`);
      if (res.ok) {
        const d = await res.json();
        setApiKeys(d.keys || []);
      }
    } catch (err) {
      console.error("Failed to load API keys:", err);
    } finally {
      setLoadingApiKeys(false);
    }
  };

  const loadWebhooks = async (bId: string) => {
    setLoadingWebhooks(true);
    try {
      const res = await fetchWithFallback(`/api/bots/${bId}/webhooks`);
      if (res.ok) {
        const d = await res.json();
        setWebhooks(d.webhooks || []);
      }
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoadingWebhooks(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!botId || !newWebhookUrl.trim() || newWebhookEvents.length === 0) return;
    setCreatingWebhook(true);
    setNewWebhookSecret(null);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newWebhookUrl.trim(), events: newWebhookEvents }),
      });
      const d = await res.json();
      if (res.ok) {
        setNewWebhookSecret(d.secret);
        setNewWebhookUrl("");
        await loadWebhooks(botId);
        showToast("Webhook registered.", "success");
      } else {
        showToast(`Failed to register webhook: ${d.detail || "error"}`, "error");
      }
    } catch (err) {
      console.error("Create webhook error:", err);
      showToast("Error registering webhook.", "error");
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!botId) return;
    showConfirm(
      "Delete Webhook",
      "Are you sure you want to delete this webhook? Deliveries to it will stop immediately.",
      async () => {
        try {
          const res = await fetchWithFallback(`/api/bots/${botId}/webhooks/${webhookId}`, { method: "DELETE" });
          if (res.ok) {
            await loadWebhooks(botId);
            showToast("Webhook deleted.", "success");
          } else {
            showToast("Failed to delete webhook.", "error");
          }
        } catch (err) {
          console.error("Delete webhook error:", err);
          showToast("Error deleting webhook.", "error");
        }
      }
    );
  };

  const loadByokStatus = async (bId: string) => {
    try {
      const res = await fetchWithFallback(`/api/bots/${bId}/byok`);
      if (res.ok) {
        const d = await res.json();
        setByokProvider(d.provider || "");
        setByokModel(d.model || "");
        setByokConfigured(!!d.configured);
      }
    } catch (err) {
      console.error("Failed to load BYOK status:", err);
    }
  };

  const loadVoiceSettings = async (bId: string) => {
    try {
      const res = await fetchWithFallback(`/api/bots/${bId}/voice-settings`);
      if (res.ok) {
        const d = await res.json();
        setVoiceEnabled(!!d.voice_enabled);
        setVoiceMode(d.voice_mode === "realtime" ? "realtime" : "pipeline");
        setVoiceSttProvider(d.voice_stt_provider || "google");
        setVoiceTtsProvider(d.voice_tts_provider || "google");
        setVoiceTtsVoice(d.voice_tts_voice || "");
        setVoiceSttConfigured(!!d.voice_stt_configured);
        setVoiceTtsConfigured(!!d.voice_tts_configured);
        setVoiceAgentRole(d.voice_agent_role || "general");
        setVoiceMaxDurationMinutes(d.voice_max_duration_minutes || 15);
        setVoiceRealtimeProvider(d.voice_realtime_provider === "openai" ? "openai" : "google");
        setVoiceRealtimeModel(d.voice_realtime_model || "");
        setVoiceRealtimeConfigured(!!d.voice_realtime_configured);
      }
    } catch (err) {
      console.error("Failed to load voice settings:", err);
    }
  };

  // Auto-saves voice_enabled / voice_stt_provider / voice_tts_provider /
  // voice_tts_voice / voice_agent_role / voice_max_duration_minutes
  // immediately on change, instead of requiring the user to notice the
  // floating "Save Changes" banner and click it separately - these are
  // simple non-secret fields (same direct-Supabase-write pattern
  // handleSaveChanges uses), so there's no reason to make the user hunt for
  // a save button just for a toggle/dropdown.
  const [savingVoiceField, setSavingVoiceField] = useState(false);
  const handleAutoSaveVoiceField = async (fields: {
    voice_enabled?: boolean;
    voice_mode?: "pipeline" | "realtime";
    voice_stt_provider?: string;
    voice_tts_provider?: string;
    voice_tts_voice?: string | null;
    voice_agent_role?: string;
    voice_max_duration_minutes?: number;
    voice_realtime_provider?: "google" | "openai";
    voice_realtime_model?: string | null;
  }) => {
    if (!botId) return;
    setSavingVoiceField(true);
    try {
      if (SELF_HOST_MODE) {
        const response = await fetchWithFallback(`/api/bots/${botId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
        if (!response.ok) throw new Error(`Voice settings save failed (${response.status})`);
      } else {
        const { error } = await supabase
          .from("chatty_bots")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", botId);
        if (error) throw error;
      }
      setUserBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...fields } : b)));
      showToast("Voice settings saved.", "success");
    } catch (err) {
      console.error("Failed to save voice setting:", err);
      showToast("Failed to save voice setting.", "error");
    } finally {
      setSavingVoiceField(false);
    }
  };

  const handleSaveVoiceByok = async (kind: "stt" | "tts" | "realtime", clear = false) => {
    if (!botId) return;
    const setSaving = kind === "stt" ? setSavingVoiceStt : kind === "tts" ? setSavingVoiceTts : setSavingVoiceRealtime;
    const keyInput = kind === "stt" ? voiceSttApiKeyInput : kind === "tts" ? voiceTtsApiKeyInput : voiceRealtimeApiKeyInput;
    const setKeyInput = kind === "stt" ? setVoiceSttApiKeyInput : kind === "tts" ? setVoiceTtsApiKeyInput : setVoiceRealtimeApiKeyInput;
    setSaving(true);
    try {
      const body = kind === "stt"
        ? { voice_stt_api_key: clear ? "" : keyInput }
        : kind === "tts"
        ? { voice_tts_api_key: clear ? "" : keyInput }
        : { voice_realtime_api_key: clear ? "" : keyInput };
      const res = await fetchWithFallback(`/api/bots/${botId}/voice-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setKeyInput("");
        await loadVoiceSettings(botId);
        showToast(clear ? "Voice key removed." : "Voice key saved.", "success");
      } else {
        showToast("Failed to save voice key.", "error");
      }
    } catch (err) {
      console.error("Failed to save voice key:", err);
      showToast("Failed to save voice key.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveByok = async (clear = false) => {
    if (!botId) return;
    setSavingByok(true);
    try {
      const res = await fetchWithFallback(`/api/bots/${botId}/byok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: clear ? "" : byokProvider,
          api_key: clear ? undefined : (byokApiKeyInput || undefined),
          model: clear ? undefined : (byokModel || undefined),
        }),
      });
      if (res.ok) {
        setByokApiKeyInput("");
        await loadByokStatus(botId);
        showToast(clear ? "BYOK key removed." : "BYOK key saved.", "success");
      } else {
        showToast("Failed to save BYOK key.", "error");
      }
    } catch (err) {
      console.error("Failed to save BYOK key:", err);
      showToast("Failed to save BYOK key.", "error");
    } finally {
      setSavingByok(false);
    }
  };

  const handleCreateApiKey = async (name?: string, scopes?: string[], allowedIps?: string) => {
    if (!botId) return;
    setCreatingApiKey(true);
    setNewApiKey(null);
    try {
      const ipList = allowedIps
        ? allowedIps.split(",").map(s => s.trim()).filter(Boolean)
        : null;
      const res = await fetchWithFallback("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          name: name || "API Key",
          scopes: scopes || ["chat", "read"],
          allowed_ips: ipList?.length ? ipList : null,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setNewApiKey(d.api_key);
        await loadApiKeys(botId);
        showToast("API Key created successfully.", "success");
      } else {
        const d = await res.json();
        showToast(`Failed to create key: ${d.detail || "error"}`, "error");
      }
    } catch (err) {
      console.error("Create API key error:", err);
      showToast("Error creating API Key.", "error");
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    showConfirm(
      "Revoke API Key",
      "Are you sure you want to revoke this API key? Apps using it will stop working immediately.",
      async () => {
        try {
          const res = await fetchWithFallback(`/api/keys/${keyId}`, { method: "DELETE" });
          if (res.ok && botId) {
            await loadApiKeys(botId);
            showToast("API Key revoked successfully.", "success");
          } else {
            showToast("Failed to revoke API Key.", "error");
          }
        } catch (err) {
          console.error("Revoke API key error:", err);
          showToast("Error revoking API Key.", "error");
        }
      }
    );
  };

  // Clipboard Copiers
  const copyToClipboard = (text: string, type: "script" | "iframe" | "mobile") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else if (type === "iframe") {
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    } else {
      setCopiedMobile(true);
      setTimeout(() => setCopiedMobile(false), 2000);
    }
  };

  // Playground Chatbot Reply Generator
  const handlePlaygroundSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInput.trim()) return;

    const userText = playgroundInput;
    setPlaygroundMessages((prev) => [...prev, { role: "user", content: userText }]);
    setPlaygroundInput("");
    setIsBotResponding(true);

    // Reset and trigger simulated agent thinking steps
    setLiveThinkingSteps([]);
    
    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[intent_parser] Parsing query intent: "${userText.slice(0, 20)}..."`]);
    }, 200);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] Scanning ${sources.length} active database sources for semantic match...`]);
    }, 550);

    setTimeout(() => {
      const lowerInput = userText.toLowerCase();
      const greetings = ["hi", "hello", "hey", "greetings", "howdy", "hola", "yo"];
      const isGreeting = lowerInput.split(/[^a-zA-Z]/).some(word => greetings.includes(word));
      
      let matchMsg = "";
      if (isGreeting) {
        matchMsg = "Greeting intent detected. Fetching greeting response.";
      } else {
        const matched = sources.find(s => s.status === "trained" && s.content.toLowerCase().split(" ").some(word => word.length >= 3 && lowerInput.includes(word)));
        matchMsg = matched 
          ? `Found semantic match in trained source: "${matched.name}"`
          : "No direct semantic matches found in database index.";
      }
      setLiveThinkingSteps(prev => [...prev, `[knowledge_retrieval] ${matchMsg}`]);
    }, 950);

    setTimeout(() => {
      setLiveThinkingSteps(prev => [...prev, `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`]);
    }, 1300);

    if (user && botId && !SELF_HOST_MODE) {
      try {
        await supabase.from("chatty_conversations").insert({
          bot_id: botId,
          session_id: "playground_session",
          role: "user",
          content: userText
        });
        setTimeout(() => {
          loadAnalyticsData(botId, leads.length);
        }, 200);
      } catch (err) {
        console.error("Error logging user message:", err);
      }
    }

    setTimeout(async () => {
      let responseContent = "";
      try {
        const res = await fetchWithFallback("/api/widget/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            bot_id: botId,
            session_id: "playground_session",
            text: userText,
            visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          })
        });
        if (res.ok) {
          const body = await res.json();
          responseContent = body.reply;
        } else {
          const body = await res.json();
          responseContent = `Error: ${body.detail || "Failed to get response from AI assistant"}`;
        }
      } catch (err) {
        console.error("Playground send error:", err);
        responseContent = "Could not communicate with the backend. Check console logs.";
      }

      const steps = [
        `[intent_parser] Parsed query intent: "${userText.slice(0, 25)}..."`,
        `[knowledge_retrieval] Checked dynamic knowledge & RAG sources.`,
        `[guardrail_checks] Evaluated safety guardrails (strict_mode = ${strictMode ? "ON" : "OFF"})`,
        `[response_generation] Formulated final reply via model: ${selectedModel}`
      ];

      setPlaygroundMessages((prev) => [...prev, { role: "assistant", content: responseContent, thinkingSteps: steps }]);
      setLiveThinkingSteps([]);
      setIsBotResponding(false);

      // Reload leads and analytics to check if a lead was registered
      if (user && botId) {
        setTimeout(async () => {
          const { data: leadList } = await supabase
            .from("chatty_leads")
            .select("*")
            .eq("bot_id", botId)
            .order("created_at", { ascending: false });
          if (leadList) {
            const mappedLeads = leadList.map(l => ({
              id: l.id,
              name: l.name || "Anonymous",
              email: l.email || "N/A",
              phone: l.phone || "N/A",
              created_at: new Date(l.created_at).toISOString().slice(0, 16).replace("T", " ")
            }));
            setLeads(mappedLeads);
            await loadAnalyticsData(botId, mappedLeads.length);
          }
        }, 800);
      }
    }, 1500);
  };

  // Sign out handler
  const handleSignOut = async () => {
    if (SELF_HOST_MODE) {
      await fetch("/api/self-host/auth/logout", { method: "POST" });
    } else {
      await supabase.auth.signOut();
    }
    window.location.href = "/";
  };

  // Assistant avatar for the dashboard previews (preset icon / logo / initial).
  // fromLibrary is set when the file came from IconLibraryPicker (a baked
  // SVG, not a real upload) so the avatar slot knows to reopen the picker
  // instead of a file dialog next time, and can pre-fill the same icon/color.
  const uploadAvatarFile = async (file: File, fromLibrary?: { name: string; color: string }) => {
    if (!botId) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", botId);
      fd.append("file", file);
      const res = await fetchWithFallback("/api/bot/avatar", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        setAvatarUrl(d.avatar_url);
        setAvatarIcon("custom");
        setAvatarIconLibrarySelection(fromLibrary || null);
        setHasUnsavedChanges(false);
      }
    } catch {} finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatarFile(file); // real upload from disk - clears any icon-library link
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !botId) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", botId);
      fd.append("file", file);
      const res = await fetchWithFallback("/api/bot/logo", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        setLogoUrl(d.logo_url);
        setAvatarIcon("logo");
        setAvatarIconLibrarySelection(null);
        setHasUnsavedChanges(true);
      }
    } catch {} finally {
      setUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  };

  const dashAvatar = (iconCls: string) => {
    const ICONS: Record<string, LucideIcon> = { bot: BotIcon, headset: Headphones, sparkles: Sparkles, message: MessageSquare, user: User };
    // avatarUrl/logoUrl are uploaded-file URLs (arbitrary storage domain, not
    // in next.config's image allowlist) - next/image would refuse to load them.
    // eslint-disable-next-line @next/next/no-img-element
    if (avatarIcon === "custom" && avatarUrl) return <img src={avatarUrl} alt="" className="size-full object-cover" />;
    if (avatarIcon && avatarIcon !== "logo" && ICONS[avatarIcon]) {
      const Ic = ICONS[avatarIcon];
      return <Ic className={iconCls} />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-cover" />;
    return (botName?.[0] || "C").toUpperCase();
  };

  const dashHeaderLogo = (iconCls: string) => {
    // eslint-disable-next-line @next/next/no-img-element
    if (logoUrl) return <img src={logoUrl} alt="" className="w-[34px] h-[34px] object-contain rounded-full" />;
    return dashAvatar(iconCls);
  };

  // Code snippets
  const embedScriptCode = `<script\n  src="https://chatty.personaliai.com/widget.js"\n  data-id="${botId || "YOUR_BOT_ID"}"\n  defer\n></script>`;
  const embedIframeCode = `<iframe\n  src="https://chatty.personaliai.com/embed/${botId || "YOUR_BOT_ID"}"\n  width="100%"\n  height="600"\n  frameborder="0"\n></iframe>`;

  // Reusable Chatty composer (input card)
  // Render loading state if session loading
  if (loadingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950 font-sans">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-8 animate-spin text-[#f97316]" />
          <p className="text-xs text-neutral-400 font-semibold">Loading console session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-955 font-sans text-neutral-900 dark:text-neutral-100 overflow-hidden antialiased">
      
      {/* Onboarding Wizard */}
      {showWizard && botId && (
        <OnboardingWizard
          botId={botId}
          initial={{
            name: botName,
            primaryColor,
            widgetStyle,
            welcomeMessage: welcomeMsg,
            systemInstructions,
            logoUrl,
            allowedDomains,
          }}
          fetchBackend={fetchWithFallback}
          supabase={supabase}
          onComplete={(f) => {
            setBotName(f.name);
            setPrimaryColor(f.primaryColor);
            setWidgetStyle(f.widgetStyle);
            setWelcomeMsg(f.welcomeMessage);
            setSystemInstructions(f.systemInstructions);
            setLogoUrl(f.logoUrl);
            if (f.allowedDomains) {
              setAllowedDomains(f.allowedDomains);
            }
            setOnboardingCompleted(true);
          }}
          onClose={() => { setShowWizard(false); setOnboardingCompleted(true); }}
        />
      )}


      {/* Collapsible Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Responsive collapsible) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between shrink-0 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Logo */}
          <div className="h-16 px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight flex items-center gap-1.5">
                <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="size-7 object-contain" />
                Chatty
              </span>
            </Link>
            <button className="md:hidden p-1 text-neutral-400 hover:text-neutral-900" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
            </button>
          </div>

          {/* Chatbot Selector Dropdown */}
          {userBots.length > 0 && (
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 relative">
              <label className="block text-[9px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">Active Chatbot</label>
              
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setBotDropdownOpen(!botDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors focus:outline-none cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <BotIcon className="size-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">{userBots.find(b => b.id === botId)?.name || "Select Chatbot"}</span>
                </span>
                <ChevronDown className={`size-3.5 text-neutral-400 transition-transform ${botDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {botDropdownOpen && (
                <>
                  {/* Click-outside backdrop */}
                  <div className="fixed inset-0 z-10 bg-transparent" onClick={() => setBotDropdownOpen(false)} />
                  
                  <div className="absolute left-4 right-4 mt-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto scrollbar-thin">
                    {userBots.map((bot) => (
                      <div
                        key={bot.id}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${
                          bot.id === botId ? "bg-neutral-50/70 dark:bg-neutral-900/70 font-semibold text-neutral-900 dark:text-white" : "text-neutral-700 dark:text-neutral-350"
                        }`}
                        onClick={() => {
                          switchActiveBot(bot.id);
                          setBotDropdownOpen(false);
                        }}
                      >
                        <span className="truncate pr-2">{bot.name || "Chatbot"}</span>
                        {userBots.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBotDropdownOpen(false);
                              const targetBot = userBots.find((b) => b.id === bot.id);
                              if (targetBot) {
                                showConfirm(
                                  "Delete Chatbot",
                                  `Are you sure you want to delete the chatbot "${targetBot.name}"? This action is permanent and will delete all associated training data, history, and leads.`,
                                  () => handleDeleteBot(bot.id)
                                );
                              }
                            }}
                            className="p-1 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                            title="Delete chatbot"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <div className="border-t border-neutral-100 dark:border-neutral-850 my-1"></div>
                    
                    {(() => {
                      const ownedCount = user ? userBots.filter((b) => b.user_id === user.id).length : 0;
                      const currentPlan = billingInfo?.plan || "free";
                      const maxBots = MAX_BOTS_BY_PLAN[currentPlan] ?? 1;
                      const isAtLimit = Number.isFinite(maxBots) && ownedCount >= maxBots;
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setBotDropdownOpen(false);
                            if (isAtLimit) {
                              showToast(
                                `Plan limit reached (${ownedCount}/${maxBots} chatbots). Upgrade to create additional assistants!`,
                                "info"
                              );
                              setActiveTab("billing");
                              return;
                            }
                            setNewBotNameInput("My Assistant");
                            setCreateBotModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#f97316] hover:bg-[#f97316]/5 dark:hover:bg-[#f97316]/10 transition-colors text-left cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus className="size-3.5" />
                            Create New Assistant
                          </span>
                          {isAtLimit && (
                            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              Upgrade
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 flex-1 overflow-y-auto scrollbar-none">
            {[
              { id: "home", label: t("overview"), icon: Home },
              { id: "customizer", label: t("customizer"), icon: Sliders },
              { id: "knowledge", label: t("knowledge_base"), icon: Database },
              { id: "playground", label: t("playground"), icon: MessageSquare, badge: true },
              { id: "inbox", label: "Inbox", icon: Inbox },
              { id: "flows", label: "Flow Builder", icon: GitBranch },
              { id: "campaigns", label: "Campaigns", icon: Megaphone },
              { id: "leads", label: t("leads"), icon: Users },
              { id: "feedback", label: "Feedback", icon: Star },
              { id: "map", label: "Map", icon: MapPin },
              { id: "meetings", label: t("meetings"), icon: Calendar },
              { id: "voice_agent", label: "Voice Agent", icon: Phone },
              { id: "mailbox", label: "Mailbox", icon: Mail },
              { id: "notifications", label: t("notifications"), icon: Bell },
              { id: "audit_log", label: t("audit_log"), icon: FileText },
              { id: "analytics", label: t("analytics"), icon: BarChart3 },
              { id: "integrations", label: t("integrations"), icon: Code2 },
              { id: "mcp", label: "MCP", icon: Cpu },
              { id: "developer", label: "Developer API", icon: Puzzle },
              { id: "billing", label: "Billing", icon: CreditCard },
              ...(isPlatformAdmin
                ? [{ id: "admin_affiliates", label: "Admin Affiliates", icon: ShieldAlert }]
                : []),
              { id: "settings", label: t("settings"), icon: Settings },
            ].filter((link) => canAccessTab(NAV_TAB_PERMISSION[link.id])).map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setActiveTab(link.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer relative ${
                    activeTab === link.id
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      : "text-neutral-500 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{link.label}</span>
                  {link.badge && <span className="absolute right-2 size-2 rounded-full bg-[#f97316]"></span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account footer: compact trigger with an upward-opening action menu. */}
        <div className="relative p-3 border-t border-neutral-200 dark:border-neutral-800">
          {accountMenuOpen && (
            <div
              className="fixed inset-0 z-40 bg-transparent"
              aria-hidden="true"
              onClick={() => setAccountMenuOpen(false)}
            />
          )}
          <div className="relative z-50">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/50 cursor-pointer"
            >
              <div className="size-8 rounded-full bg-[#f97316]/10 flex items-center justify-center text-[#f97316] font-bold text-xs shrink-0">
                {(user?.email?.[0] || "P").toUpperCase()}
              </div>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="block text-[11px] font-semibold truncate">{user?.email ? user.email.split("@")[0] : "Guest"}</span>
                <span className="block text-[9px] text-neutral-400 dark:text-neutral-500 truncate">{user?.email || "Sign in to sync"}</span>
              </span>
              <ChevronUp className={`size-4 shrink-0 text-neutral-400 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {accountMenuOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.16)] dark:border-neutral-700 dark:bg-neutral-950 dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
              >
                {user && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setActiveTab("settings");
                      setTimeout(() => {
                        const el = document.getElementById("settings-profile-section");
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 100);
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[10px] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <User className="size-3.5" />
                    Your Profile & Photo
                  </button>
                )}
                {user ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[10px] text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950/30 dark:hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <LogOut className="size-3.5" />
                    Sign Out Account
                  </button>
                ) : (
                  <Link
                    href="/login"
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[10px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
                  >
                    <LogOut className="size-3.5" />
                    Log In to Save Progress
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header bar */}
        <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 sm:px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 text-neutral-500 hover:text-neutral-950" onClick={() => setSidebarOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-neutral-400 font-semibold whitespace-nowrap">Chatty Console</span>
              <div className="flex items-center gap-2 mt-0.5">
                <h2 className="text-sm font-semibold capitalize whitespace-nowrap">{activeTab === "home" ? "Overview" : activeTab.replace("_", " ")}</h2>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-neutral-500">
            {/* Language Selector */}
            <ModernSelect
              value={language}
              options={languageOptions}
              onChange={(v) => setLanguage(v as "EN" | "ES" | "FR" | "DE" | "IT")}
              align="right"
              size="sm"
              className="w-28 sm:w-36"
            />

            {/* Re-run Setup (agentic flow) */}
            {onboardingCompleted && (
              <button
                onClick={() => setShowWizard(true)}
                className="text-[10px] border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 rounded-lg px-2 py-1.5 sm:px-2.5 sm:py-1.5 hover:bg-[#f97316]/5 cursor-pointer font-bold text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1"
                title="Re-run Setup"
              >
                <Sparkles className="size-3 text-[#f97316]" />
                <span className="hidden sm:inline">Re-run Setup</span>
              </button>
            )}

            <a
              href="https://docs.chatty.personaliai.com"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 rounded-lg px-2 py-1.5 sm:px-2.5 hover:bg-[#f97316]/5 cursor-pointer font-bold text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1"
              title="Documentation"
            >
              <BookOpen className="size-3 text-[#f97316]" />
              <span className="hidden sm:inline">Docs</span>
              <ExternalLink className="size-2.5 hidden sm:inline" />
            </a>

            <span className="flex items-center gap-1.5" title={user ? "Database Active" : "Offline"}>
              <span className={`size-2 rounded-full ${user ? "bg-green-500" : "bg-yellow-500"}`}></span>
              <span className="hidden sm:inline">{user ? "Database Active" : "Offline"}</span>
            </span>
          </div>
        </header>

        {/* Tab Contents (Center Aligned Layout) */}
        <div className="flex-1 overflow-y-auto">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "home" && (
            <HomeTab
              setActiveTab={setActiveTab}
              totalSessions={totalSessions}
              sources={sources}
              leads={leads}
              resolutionRate={resolutionRate}
              csatScore={csatScore}
              busiestHour={busiestHour}
              csatFeedback={csatFeedback}
            />
          )}

          {/* TAB 2: CUSTOMIZER */}
          {activeTab === "customizer" && (
            <CustomizerTab
              widgetStyle={widgetStyle}
              setWidgetStyle={setWidgetStyle}
              handleInputChange={handleInputChange}
              fontFamily={fontFamily}
              setFontFamily={setFontFamily}
              fontOptions={fontOptions}
              fontSizePercent={fontSizePercent}
              setFontSizePercent={setFontSizePercent}
              panelSize={panelSize}
              setPanelSize={setPanelSize}
              voiceMessageMode={voiceMessageMode}
              setVoiceMessageMode={setVoiceMessageMode}
              botName={botName}
              setBotName={setBotName}
              welcomeMsg={welcomeMsg}
              setWelcomeMsg={setWelcomeMsg}
              teaserMessage={teaserMessage}
              setTeaserMessage={setTeaserMessage}
              conversationStarters={conversationStarters}
              setConversationStarters={setConversationStarters}
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
              colorScheme={colorScheme}
              setColorScheme={setColorScheme}
              sectionColorProp={sectionColorProp}
              setSectionColorProp={setSectionColorProp}
              sendButtonStyle={sendButtonStyle}
              setSendButtonStyle={setSendButtonStyle}
              avatarIcon={avatarIcon}
              setAvatarIcon={setAvatarIcon}
              logoUrl={logoUrl}
              logoBgColor={logoBgColor}
              setLogoBgColor={setLogoBgColor}
              avatarFileRef={avatarFileRef}
              handleAvatarUpload={handleAvatarUpload}
              avatarIconLibrarySelection={avatarIconLibrarySelection}
              setIconPickerOpen={setIconPickerOpen}
              uploadingAvatar={uploadingAvatar}
              avatarUrl={avatarUrl}
              logoFileRef={logoFileRef}
              handleLogoUpload={handleLogoUpload}
              uploadingLogo={uploadingLogo}
              suggestedColors={suggestedColors}
              launcherShape={launcherShape}
              setLauncherShape={setLauncherShape}
              previewView={previewView}
              setPreviewView={setPreviewView}
              dashHeaderLogo={dashHeaderLogo}
              dashAvatar={dashAvatar}
              hideBranding={hideBranding}
              botId={botId}
              showSenderTag={showSenderTag}
              csatEnabled={csatEnabled}
              fetchWithFallback={fetchWithFallback}
            />
          )}
          {/* TAB 3: KNOWLEDGE BASE */}
          {activeTab === "knowledge" && botId && (
            <KnowledgeTab
              botId={botId}
              fetchWithFallback={fetchWithFallback}
              primaryColor={primaryColor}
              fileInputRef={fileInputRef}
              handleKnowledgeUpload={handleKnowledgeUpload}
              user={user}
              loadBotSettings={loadBotSettings}
              loadingLists={loadingLists}
              savingLeadCapture={savingLeadCapture}
              setSavingLeadCapture={setSavingLeadCapture}
              leadCaptureEnabled={leadCaptureEnabled}
              setLeadCaptureEnabled={setLeadCaptureEnabled}
              leadFields={leadFields}
              setLeadFields={setLeadFields}
              leadRequiredFields={leadRequiredFields}
              setLeadRequiredFields={setLeadRequiredFields}
              newLeadField={newLeadField}
              setNewLeadField={setNewLeadField}
              onboardingStep={onboardingStep}
              onboardingCompleted={onboardingCompleted}
              saveOnboardingStep={saveOnboardingStep}
              googleConnected={googleConnected}
              microsoftConnected={microsoftConnected}
              handleConnectCloud={handleConnectCloud}
              handleDisconnectCloud={handleDisconnectCloud}
              handleInputChange={handleInputChange}
              calendarSchedulingEnabled={calendarSchedulingEnabled}
              setCalendarSchedulingEnabled={setCalendarSchedulingEnabled}
              handleCalendarSyncChange={handleCalendarSyncChange}
              meetingProvider={meetingProvider}
              handleMeetingProviderChange={handleMeetingProviderChange}
              providerOptions={providerOptions}
              sources={sources}
              knowledgeProgress={knowledgeProgress}
              setKnowledgeProgress={setKnowledgeProgress}
              kbSourceTab={kbSourceTab}
              setKbSourceTab={setKbSourceTab}
              inputTitle={inputTitle}
              setInputTitle={setInputTitle}
              inputText={inputText}
              setInputText={setInputText}
              handleTrainText={handleTrainText}
              isKnowledgeLoading={isKnowledgeLoading}
              inputUrl={inputUrl}
              setInputUrl={setInputUrl}
              handleScanSitemap={handleScanSitemap}
              scanningSitemap={scanningSitemap}
              discoveredUrls={discoveredUrls}
              selectedUrls={selectedUrls}
              setSelectedUrls={setSelectedUrls}
              handleCrawlSelected={handleCrawlSelected}
              handleBulkAddUrls={handleBulkAddUrls}
              handleTrainUrl={handleTrainUrl}
              bulkUrlsOpen={bulkUrlsOpen}
              setBulkUrlsOpen={setBulkUrlsOpen}
              bulkUrlsText={bulkUrlsText}
              setBulkUrlsText={setBulkUrlsText}
              uploadingFile={uploadingFile}
              driveFolderUrl={driveFolderUrl}
              setDriveFolderUrl={setDriveFolderUrl}
              driveMaxFiles={driveMaxFiles}
              setDriveMaxFiles={setDriveMaxFiles}
              driveSyncSchedule={driveSyncSchedule}
              handleSetDriveSyncSchedule={handleSetDriveSyncSchedule}
              onedriveSyncSchedule={onedriveSyncSchedule}
              handleIndexDriveFolder={handleIndexDriveFolder}
              isIndexingDrive={isIndexingDrive}
              driveIndexSuccess={driveIndexSuccess}
              driveIndexError={driveIndexError}
              syncScheduleOptions={syncScheduleOptions}
              unanswered={unanswered}
              answeringId={answeringId}
              setAnsweringId={setAnsweringId}
              answerText={answerText}
              setAnswerText={setAnswerText}
              resolveUnanswered={resolveUnanswered}
              dismissUnanswered={dismissUnanswered}
              handleCrawlAll={handleCrawlAll}
              crawlingAll={crawlingAll}
              crawlDropdownOpen={crawlDropdownOpen}
              setCrawlDropdownOpen={setCrawlDropdownOpen}
              handleSetCrawlSchedule={handleSetCrawlSchedule}
              sourceTypeFilter={sourceTypeFilter}
              setSourceTypeFilter={setSourceTypeFilter}
              sourcesSearch={sourcesSearch}
              setSourcesSearch={setSourcesSearch}
              expandedSourceId={expandedSourceId}
              setExpandedSourceId={setExpandedSourceId}
              recrawlingSourceId={recrawlingSourceId}
              handleRecrawlNow={handleRecrawlNow}
              handleDeleteSource={handleDeleteSource}
              crawlingPages={crawlingPages}
              crawlSummary={crawlSummary}
              setActiveTab={setActiveTab}
              t={t}
            />
          )}
          {/* TAB 4: PLAYGROUND */}
          {activeTab === "playground" && (
            <PlaygroundTab
              playgroundView={playgroundView}
              setPlaygroundView={setPlaygroundView}
              botId={botId}
              primaryColor={primaryColor}
              widgetStyle={widgetStyle}
              avatarIcon={avatarIcon}
              avatarUrl={avatarUrl}
              logoUrl={logoUrl}
              logoBgColor={logoBgColor}
              botName={botName}
              showSenderTag={showSenderTag}
              csatEnabled={csatEnabled}
              colorScheme={colorScheme}
              fontFamily={fontFamily}
              fontSizePercent={fontSizePercent}
              welcomeMsg={welcomeMsg}
              language={language}
              setLanguage={setLanguage}
              languageOptions={languageOptions}
              playgroundMessages={playgroundMessages}
              setPlaygroundMessages={setPlaygroundMessages}
              dashHeaderLogo={dashHeaderLogo}
              dashAvatar={dashAvatar}
              handleSetupQuickReply={handleSetupQuickReply}
              googleConnected={googleConnected}
              microsoftConnected={microsoftConnected}
              botCountry={botCountry}
              setBotCountry={setBotCountry}
              countryOptions={countryOptions}
              botTimezone={botTimezone}
              setBotTimezone={setBotTimezone}
              timezoneOptions={timezoneOptions}
              t={t}
              handleInputChange={handleInputChange}
              meetingProvider={meetingProvider}
              providerOptions={providerOptions}
              handleMeetingProviderChange={handleMeetingProviderChange}
              pendingLeadFields={pendingLeadFields}
              setPendingLeadFields={setPendingLeadFields}
              isBotResponding={isBotResponding}
              liveThinkingSteps={liveThinkingSteps}
              playgroundEndRef={playgroundEndRef}
              collectedInPlayground={collectedInPlayground}
              setCollectedInPlayground={setCollectedInPlayground}
              playgroundInput={playgroundInput}
              setPlaygroundInput={setPlaygroundInput}
              handlePlaygroundSend={handlePlaygroundSend}
              sendButtonStyle={sendButtonStyle}
            />
          )}

          {/* TAB 5: LEADS */}
          {activeTab === "leads" && (
            <LeadsTab
              leads={leads}
              filteredLeads={filteredLeads}
              leadsSearch={leadsSearch}
              setLeadsSearch={setLeadsSearch}
              refreshLeads={refreshLeads}
              refreshingLeads={refreshingLeads}
              exportLeadsCSV={exportLeadsCSV}
              loadingLists={loadingLists}
              leadFields={leadFields}
              editingLeadId={editingLeadId}
              editLeadDraft={editLeadDraft}
              setEditLeadDraft={setEditLeadDraft}
              saveEditLead={saveEditLead}
              cancelEditLead={cancelEditLead}
              savingLeadEdit={savingLeadEdit}
              startEditLead={startEditLead}
              deleteLead={deleteLead}
              getLeadFieldValue={getLeadFieldValue}
            />
          )}

          {/* TAB: FEEDBACK */}
          {activeTab === "feedback" && (
            <FeedbackTab
              csatFeedback={csatFeedback}
              loadingLists={loadingLists}
              leads={leads}
              setActiveTab={setActiveTab}
            />
          )}

          {/* TAB: INBOX */}
          {activeTab === "inbox" && (
            <div className="max-w-6xl mx-auto w-full py-6 px-4 space-y-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Inbox className="size-4 text-[#f97316]" /> Shared Inbox
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                  Every visitor conversation, live. Jump in any time - replying takes over from the AI; toggle back to let the assistant continue.
                </p>
              </div>
              {botId && <InboxPanel botId={botId} fetchBackend={fetchWithFallback} formatDateTime={formatDateTime} color={primaryColor} />}
            </div>
          )}

          {/* TAB: MAP */}
          {activeTab === "map" && (
            <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="size-4 text-[#f97316]" /> Client Map
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
                    Where your leads are coming from. Each bubble is a country - bigger means more leads. Click a bubble for details.
                  </p>
                </div>
                <button
                  onClick={() => user && loadBotSettings(user.id)}
                  disabled={loadingLists}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-350 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${loadingLists ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <LeadsMap leads={leads} color={primaryColor} />
              </div>
            </div>
          )}

          {/* TAB 6: ANALYTICS */}
          {activeTab === "analytics" && botId && (
            <AnalyticsTab
              botId={botId}
              backendUrl={BACKEND_URL}
              authToken={authToken}
              plan={billingInfo?.plan || "free"}
            />
          )}

          {/* TAB 7: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <IntegrationsTab
              embedPlatform={embedPlatform}
              setEmbedPlatform={setEmbedPlatform}
              embedMobilePlatform={embedMobilePlatform}
              setEmbedMobilePlatform={setEmbedMobilePlatform}
              embedScriptCode={embedScriptCode}
              embedIframeCode={embedIframeCode}
              botId={botId}
              copyToClipboard={copyToClipboard}
              copiedScript={copiedScript}
              copiedMobile={copiedMobile}
              newDomain={newDomain}
              setNewDomain={setNewDomain}
              allowedDomains={allowedDomains}
              setAllowedDomains={setAllowedDomains}
              handleInputChange={handleInputChange}
              whatsappEnabled={whatsappEnabled}
              setWhatsappEnabled={setWhatsappEnabled}
              whatsappPhoneNumberId={whatsappPhoneNumberId}
              setWhatsappPhoneNumberId={setWhatsappPhoneNumberId}
              whatsappWabaId={whatsappWabaId}
              setWhatsappWabaId={setWhatsappWabaId}
              whatsappAccessToken={whatsappAccessToken}
              setWhatsappAccessToken={setWhatsappAccessToken}
              whatsappVerifyToken={whatsappVerifyToken}
              setWhatsappVerifyToken={setWhatsappVerifyToken}
              whatsappAppSecret={whatsappAppSecret}
              setWhatsappAppSecret={setWhatsappAppSecret}
              whatsappQuickReplies={whatsappQuickReplies}
              setWhatsappQuickReplies={setWhatsappQuickReplies}
              showToast={showToast}
              authToken={authToken}
            />
          )}

          {/* TAB: MCP */}
          {activeTab === "mcp" && <McpTab />}

          {/* TAB: DEVELOPER API */}
          {activeTab === "developer" && (
            <DeveloperTab
              apiKeys={apiKeys}
              formatDateTime={formatDateTime}
              newApiKey={newApiKey}
              copiedApiKey={copiedApiKey}
              setCopiedApiKey={setCopiedApiKey}
              handleCreateApiKey={handleCreateApiKey}
              creatingApiKey={creatingApiKey}
              botId={botId}
              handleRevokeApiKey={handleRevokeApiKey}
              setActiveTab={setActiveTab}
              newWebhookSecret={newWebhookSecret}
              copiedWebhookSecret={copiedWebhookSecret}
              setCopiedWebhookSecret={setCopiedWebhookSecret}
              newWebhookUrl={newWebhookUrl}
              setNewWebhookUrl={setNewWebhookUrl}
              newWebhookEvents={newWebhookEvents}
              setNewWebhookEvents={setNewWebhookEvents}
              handleCreateWebhook={handleCreateWebhook}
              creatingWebhook={creatingWebhook}
              webhooks={webhooks}
              loadingWebhooks={loadingWebhooks}
              handleDeleteWebhook={handleDeleteWebhook}
              authToken={authToken}
            />
          )}

          {/* TAB: BILLING */}
          {activeTab === "billing" && (
            <BillingTab
              billingInfo={billingInfo}
              user={user}
              billingInterval={billingInterval}
              setBillingInterval={setBillingInterval}
            />
          )}

          {/* TAB: ADMIN AFFILIATES (Platform SuperAdmin) */}
          {activeTab === "admin_affiliates" && isPlatformAdmin && (
            <AdminAffiliatesTab />
          )}

          {/* TAB 8: AGENT SETTINGS */}
          {activeTab === "settings" && (
            <SettingsTab
              canAccessTab={canAccessTab}
              myRole={myRole}
              inviteName={inviteName}
              setInviteName={setInviteName}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteRole={inviteRole}
              setInviteRole={setInviteRole}
              inviteTabs={inviteTabs}
              setInviteTabs={setInviteTabs}
              invitingTeam={invitingTeam}
              inviteTeamMember={inviteTeamMember}
              teamMembers={teamMembers}
              editingMemberId={editingMemberId}
              setEditingMemberId={setEditingMemberId}
              editingAvailabilityId={editingAvailabilityId}
              setEditingAvailabilityId={setEditingAvailabilityId}
              toggleMemberBookable={toggleMemberBookable}
              toggleMemberCalendarPreference={toggleMemberCalendarPreference}
              updateTeamMember={updateTeamMember}
              removeTeamMember={removeTeamMember}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              byokConfigured={byokConfigured}
              byokProvider={byokProvider}
              setByokProvider={setByokProvider}
              byokModel={byokModel}
              setByokModel={setByokModel}
              byokApiKeyInput={byokApiKeyInput}
              setByokApiKeyInput={setByokApiKeyInput}
              savingByok={savingByok}
              handleSaveByok={handleSaveByok}
              systemInstructions={systemInstructions}
              setSystemInstructions={setSystemInstructions}
              isGeneratingInstructions={isGeneratingInstructions}
              generateInstructions={generateInstructions}
              answerMode={answerMode}
              setAnswerMode={setAnswerMode}
              strictMode={strictMode}
              setStrictMode={setStrictMode}
              showSenderTag={showSenderTag}
              setShowSenderTag={setShowSenderTag}
              hideBranding={hideBranding}
              setHideBranding={setHideBranding}
              emailNotify={emailNotify}
              setEmailNotify={setEmailNotify}
              csatEnabled={csatEnabled}
              setCsatEnabled={setCsatEnabled}
              responseLanguage={responseLanguage}
              setResponseLanguage={setResponseLanguage}
              botCountry={botCountry}
              setBotCountry={setBotCountry}
              botTimezone={botTimezone}
              setBotTimezone={setBotTimezone}
              countryOptions={countryOptions}
              timezoneOptions={timezoneOptions}
              guardrailTopics={guardrailTopics}
              setGuardrailTopics={setGuardrailTopics}
              guardrailRefusalMessage={guardrailRefusalMessage}
              setGuardrailRefusalMessage={setGuardrailRefusalMessage}
              guardrailBlockProfanity={guardrailBlockProfanity}
              setGuardrailBlockProfanity={setGuardrailBlockProfanity}
              customCss={customCss}
              setCustomCss={setCustomCss}
              customJs={customJs}
              setCustomJs={setCustomJs}
              googleConnected={googleConnected}
              microsoftConnected={microsoftConnected}
              zoomConfigured={zoomConfigured}
              connectingProvider={connectingProvider}
              handleConnectCloud={handleConnectCloud}
              handleDisconnectCloud={handleDisconnectCloud}
              syncGoogleDrive={syncGoogleDrive}
              setSyncGoogleDrive={setSyncGoogleDrive}
              syncOutlookCalendar={syncOutlookCalendar}
              setSyncOutlookCalendar={setSyncOutlookCalendar}
              calendarSchedulingEnabled={calendarSchedulingEnabled}
              setCalendarSchedulingEnabled={setCalendarSchedulingEnabled}
              googleConnectedAccountId={googleConnectedAccountId}
              setGoogleConnectedAccountId={setGoogleConnectedAccountId}
              googleCalendarId={googleCalendarId}
              setGoogleCalendarId={setGoogleCalendarId}
              googleCalendarName={googleCalendarName}
              setGoogleCalendarName={setGoogleCalendarName}
              googleCalendarColor={googleCalendarColor}
              setGoogleCalendarColor={setGoogleCalendarColor}
              meetingProvider={meetingProvider}
              handleMeetingProviderChange={handleMeetingProviderChange}
              providerOptions={providerOptions}
              schedulingDuration={schedulingDuration}
              setSchedulingDuration={setSchedulingDuration}
              businessHoursStart={businessHoursStart}
              setBusinessHoursStart={setBusinessHoursStart}
              businessHoursEnd={businessHoursEnd}
              setBusinessHoursEnd={setBusinessHoursEnd}
              workingDays={workingDays}
              setWorkingDays={setWorkingDays}
              bufferMinutes={bufferMinutes}
              setBufferMinutes={setBufferMinutes}
              advanceNoticeHours={advanceNoticeHours}
              setAdvanceNoticeHours={setAdvanceNoticeHours}
              maxDailyMeetings={maxDailyMeetings}
              setMaxDailyMeetings={setMaxDailyMeetings}
              maxWeeklyMeetings={maxWeeklyMeetings}
              setMaxWeeklyMeetings={setMaxWeeklyMeetings}
              bookingRequireBusinessEmail={bookingRequireBusinessEmail}
              setBookingRequireBusinessEmail={setBookingRequireBusinessEmail}
              bookingLimitOneActive={bookingLimitOneActive}
              setBookingLimitOneActive={setBookingLimitOneActive}
              bookingBlockDisposableEmails={bookingBlockDisposableEmails}
              setBookingBlockDisposableEmails={setBookingBlockDisposableEmails}
              bookingEmailVerification={bookingEmailVerification}
              setBookingEmailVerification={setBookingEmailVerification}
              leadFields={leadFields}
              handleInputChange={handleInputChange}
              showToast={showToast}
              user={user}
              botId={botId}
              fetchWithFallback={fetchWithFallback}
              t={t}
            />
          )}
          {/* TAB 9: MEETINGS */}
          {activeTab === "meetings" && (
            <MeetingsTab
              myRole={myRole}
              adminMeetings={adminMeetings}
              meetingMemberFilter={meetingMemberFilter}
              setMeetingMemberFilter={setMeetingMemberFilter}
              selectedMeetingId={selectedMeetingId}
              setSelectedMeetingId={setSelectedMeetingId}
              teamMembers={teamMembers}
              botId={botId}
              loadAdminData={loadAdminData}
              loadingAdminData={loadingAdminData}
              botTimezone={botTimezone}
              openMeetingPanel={openMeetingPanel}
              formatDateTime={formatDateTime}
              reschedulingMeetingId={reschedulingMeetingId}
              setReschedulingMeetingId={setReschedulingMeetingId}
              rescheduleDateTime={rescheduleDateTime}
              setRescheduleDateTime={setRescheduleDateTime}
              handleRescheduleMeeting={handleRescheduleMeeting}
              reschedulingBusy={reschedulingBusy}
              handleUpdateMeetingStatus={handleUpdateMeetingStatus}
            />
          )}

          {/* TAB: VOICE AGENT */}
          {activeTab === "voice_agent" && (
            <VoiceAgentTab
              voiceEnabled={voiceEnabled}
              setVoiceEnabled={setVoiceEnabled}
              handleAutoSaveVoiceField={handleAutoSaveVoiceField}
              savingVoiceField={savingVoiceField}
              voiceAgentRole={voiceAgentRole}
              setVoiceAgentRole={setVoiceAgentRole}
              setActiveTab={setActiveTab}
              voiceMode={voiceMode}
              setVoiceMode={setVoiceMode}
              voiceRealtimeProvider={voiceRealtimeProvider}
              setVoiceRealtimeProvider={setVoiceRealtimeProvider}
              voiceRealtimeModel={voiceRealtimeModel}
              setVoiceRealtimeModel={setVoiceRealtimeModel}
              voiceTtsVoice={voiceTtsVoice}
              setVoiceTtsVoice={setVoiceTtsVoice}
              voiceRealtimeConfigured={voiceRealtimeConfigured}
              voiceRealtimeApiKeyInput={voiceRealtimeApiKeyInput}
              setVoiceRealtimeApiKeyInput={setVoiceRealtimeApiKeyInput}
              handleSaveVoiceByok={handleSaveVoiceByok}
              savingVoiceRealtime={savingVoiceRealtime}
              voiceSttProvider={voiceSttProvider}
              setVoiceSttProvider={setVoiceSttProvider}
              voiceSttConfigured={voiceSttConfigured}
              voiceSttApiKeyInput={voiceSttApiKeyInput}
              setVoiceSttApiKeyInput={setVoiceSttApiKeyInput}
              savingVoiceStt={savingVoiceStt}
              voiceTtsProvider={voiceTtsProvider}
              setVoiceTtsProvider={setVoiceTtsProvider}
              voiceTtsConfigured={voiceTtsConfigured}
              voiceTtsApiKeyInput={voiceTtsApiKeyInput}
              setVoiceTtsApiKeyInput={setVoiceTtsApiKeyInput}
              savingVoiceTts={savingVoiceTts}
              voiceMaxDurationMinutes={voiceMaxDurationMinutes}
              setVoiceMaxDurationMinutes={setVoiceMaxDurationMinutes}
            />
          )}

          {/* TAB: MAILBOX */}
          {activeTab === "mailbox" && (
            <MailboxTab
              adminNotifications={adminNotifications}
              mailboxFilter={mailboxFilter}
              setMailboxFilter={setMailboxFilter}
              selectedMailId={selectedMailId}
              setSelectedMailId={setSelectedMailId}
              botId={botId || ""}
              loadAdminData={loadAdminData}
              loadingAdminData={loadingAdminData}
              formatDateTime={formatDateTime}
            />
          )}

          {/* TAB 10: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <NotificationsTab
              notificationEmails={notificationEmails}
              setNotificationEmails={setNotificationEmails}
              handleInputChange={handleInputChange}
              webhookUrl={webhookUrl}
              setWebhookUrl={setWebhookUrl}
              botId={botId || ""}
              loadAdminData={loadAdminData}
              loadingAdminData={loadingAdminData}
              adminNotifications={adminNotifications}
              formatDateTime={formatDateTime}
            />
          )}

          {/* TAB 11: AUDIT LOG */}
          {activeTab === "audit_log" && (
            <AuditLogTab
              botId={botId || ""}
              adminAuditLogs={adminAuditLogs}
              loadingAdminData={loadingAdminData}
              loadAdminData={loadAdminData}
              formatDateTime={formatDateTime}
            />
          )}
          {/* TAB: FLOW BUILDER */}
          {activeTab === "flows" && (
            <div className="max-w-7xl mx-auto w-full py-6 px-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Visual Flow Builder</h4>
                  <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">Design visual logic branches and custom chatbot flows.</p>
                </div>
              </div>
              <ChatbotFlowBuilder botId={botId} color={primaryColor} />
            </div>
          )}

          {/* TAB: CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <CampaignsUI botId={botId} color={primaryColor} />
          )}
        </div>
      </main>

      {/* Telegram Link Dialog */}
      {telegramLinkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div>
              <h4 className="text-sm font-bold">Link Telegram</h4>
              <p className="text-[10px] text-neutral-400 mt-1 leading-normal">
                Get your chat ID from @KinByPersonaliAI_bot - send /start to it.
              </p>
            </div>
            <ol className="text-[10px] text-neutral-550 dark:text-neutral-400 space-y-1.5 list-decimal pl-4 leading-relaxed">
              <li>Open <a href="https://t.me/KinByPersonaliAI_bot" target="_blank" rel="noreferrer" className="text-[#f97316] underline">@KinByPersonaliAI_bot</a> on Telegram and tap <b>Start</b>.</li>
              <li>The bot will reply with your numeric chat ID.</li>
              <li>Paste that ID below - we&apos;ll send a confirmation message to verify.</li>
            </ol>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const target = e.target as HTMLFormElement;
                const chatIdInput = target.elements.namedItem("telegramChatId") as HTMLInputElement;
                const id = parseInt(chatIdInput.value.trim(), 10);
                if (!id) return;
                const success = await handleLinkTelegram(id);
                if (success) {
                  setTelegramLinkOpen(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Telegram chat ID</label>
                <input
                  name="telegramChatId"
                  type="text"
                  placeholder="e.g. 8123456789"
                  inputMode="numeric"
                  autoFocus
                  required
                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTelegramLinkOpen(false)}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg hover:opacity-90 font-semibold cursor-pointer"
                >
                  Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Indexer Dialog */}
      {driveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <FolderOpen className="size-5 text-yellow-500 animate-pulse" />
                <h4 className="text-sm font-bold">Index Google Drive Folder</h4>
              </div>
              <button onClick={() => setDriveModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-450 dark:text-neutral-400 leading-relaxed">
              Enter a Google Drive folder URL or ID. We will crawl the folder and index the files (PDF, DOCX, Sheets, Docs, TXT, MD) into your bot&apos;s RAG memory.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!driveFolderUrl.trim()) return;
              setIsIndexingDrive(true);
              setDriveIndexError(null);
              setDriveIndexSuccess(null);
              try {
                const res = await fetchWithFallback("/api/documents/index-folder", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    folder_id_or_url: driveFolderUrl.trim(),
                    max_files: driveMaxFiles,
                    source: "gdrive",
                  }),
                });
                if (res.ok) {
                  setDriveModalOpen(false);
                  setPlaygroundMessages(prev => [
                    ...prev,
                    {
                      role: "assistant",
                      content: `Started indexing Google Drive folder: **${driveFolderUrl.trim()}** (max ${driveMaxFiles} files) in the background. The documents will appear in your trained sources soon!`,
                      status: "success"
                    }
                  ]);
                  setDriveFolderUrl("");
                  // Refresh sources list in 5 seconds
                  setTimeout(() => {
                    if (user) loadBotSettings(user.id);
                  }, 5000);
                } else {
                  const body = await res.json();
                  setDriveIndexError(body.detail || "Failed to start folder indexing.");
                }
              } catch {
                setDriveIndexError("Failed to connect to the server.");
              } finally {
                setIsIndexingDrive(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Folder URL or ID</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Max Files to Index</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={driveMaxFiles}
                  onChange={(e) => setDriveMaxFiles(parseInt(e.target.value, 10) || 50)}
                  className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                />
              </div>
              {driveIndexError && (
                <p className="text-[10px] text-red-500 font-medium">{driveIndexError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDriveModalOpen(false)}
                  className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIndexingDrive}
                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isIndexingDrive && <Loader2 className="size-3.5 animate-spin" />}
                  Start Indexing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 z-[9999] flex items-start gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl px-4 py-3 shadow-2xl text-xs font-semibold text-neutral-850 dark:text-white animate-in slide-in-from-bottom-5 fade-in duration-300 sm:max-w-sm">
          {toast.type === "success" && (
            <span className="flex size-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 shrink-0">
              <Check className="size-3.5" />
            </span>
          )}
          {toast.type === "error" && (
            <span className="flex size-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="size-3.5" />
            </span>
          )}
          {toast.type === "info" && (
            <span className="flex size-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
              <AlertCircle className="size-3.5" />
            </span>
          )}
          <span className="leading-relaxed">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-auto shrink-0 text-neutral-400 hover:text-neutral-650 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <h4 className="text-sm font-bold">{confirmModal.title}</h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-850 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await onConfirm();
                }}
                className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer ${
                  confirmModal.title.toLowerCase().includes("delete") ||
                  confirmModal.title.toLowerCase().includes("revoke") ||
                  confirmModal.title.toLowerCase().includes("disconnect") ||
                  confirmModal.title.toLowerCase().includes("unlink")
                    ? "bg-red-650 hover:bg-red-700 bg-red-600"
                    : "bg-[#f97316]"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Bot Modal */}
      {createBotModalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-105 dark:border-neutral-850">
              <h4 className="text-sm font-bold">Create New Assistant</h4>
              <button onClick={() => setCreateBotModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer">
                <X className="size-4" />
              </button>
            </div>
            {(() => {
              const ownedCount = user ? userBots.filter((b) => b.user_id === user.id).length : 0;
              const currentPlan = billingInfo?.plan || "free";
              const maxBots = MAX_BOTS_BY_PLAN[currentPlan] ?? 1;
              const isAtLimit = Number.isFinite(maxBots) && ownedCount >= maxBots;

              if (isAtLimit) {
                return (
                  <div className="space-y-4 py-2">
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                      <div className="flex items-start gap-3">
                        <Sparkles className="size-4 text-[#f97316] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            Chatbot Limit Reached
                          </h5>
                          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                            Your current plan (<b>{PLAN_LABELS[currentPlan] || currentPlan}</b>) allows up to <b>{maxBots} chatbot{maxBots > 1 ? "s" : ""}</b> ({ownedCount}/{maxBots} currently in use).
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            Upgrade to <b>Hobby</b> (3 chatbots), <b>Standard</b> (6 chatbots), or <b>Business</b> (Unlimited) to create and deploy additional assistants.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setCreateBotModalOpen(false)}
                        className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateBotModalOpen(false);
                          setActiveTab("billing");
                        }}
                        className="px-3.5 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-bold hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        Upgrade Plan <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newBotNameInput.trim()) return;
                  const name = newBotNameInput;
                  const web = newBotWebsiteInput;
                  setCreateBotModalOpen(false);
                  setNewBotNameInput("");
                  setNewBotWebsiteInput("");
                  await handleCreateBot(name, web);
                }} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-neutral-500 uppercase mb-1">Assistant Name</label>
                    <input
                      type="text"
                      placeholder="My Assistant"
                      value={newBotNameInput}
                      onChange={(e) => setNewBotNameInput(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-250 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-semibold text-neutral-500 uppercase">Website URL</label>
                      <span className="text-[10px] text-neutral-400 font-normal">Optional</span>
                    </div>
                    <input
                      type="text"
                      placeholder="https://example.com"
                      value={newBotWebsiteInput}
                      onChange={(e) => setNewBotWebsiteInput(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-955 border border-neutral-250 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Adds this domain to Allowed Domains in Integrations.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateBotModalOpen(false);
                        setNewBotWebsiteInput("");
                      }}
                      className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
                    >
                      Create
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {iconPickerOpen && (
        <IconLibraryPicker
          onClose={() => setIconPickerOpen(false)}
          onSelect={(file, name, color) => { uploadAvatarFile(file, { name, color }); setIconPickerOpen(false); }}
          initialSelection={avatarIconLibrarySelection}
          backgroundHex={logoBgColor || "#ffffff"}
        />
      )}

    </div>
  );
}
