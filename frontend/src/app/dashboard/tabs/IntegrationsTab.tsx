"use client";

import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import React, { useState } from "react";
import {
  Check,
  Copy,
  ShieldAlert,
  Plus,
  Globe,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Key,
  ShieldCheck,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";

const LOGO_DEV_TOKEN = "pk_O9y7kfwmQGa93ZxG6XwufQ";

const logoUrl = (domain: string) =>
  `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=80&format=png&retina=true`;

const EMAIL_AUTO_REPLY_MODE_OPTIONS: ModernSelectOption[] = [
  {
    value: "instant_ai",
    label: "Instant Autonomous AI Auto-Reply (Direct Send)",
    hint: "Autonomous replies immediately with full AI reasoning",
  },
  {
    value: "draft_copilot",
    label: "AI Draft Co-Pilot (Helpdesk / Agent Review)",
    hint: "Leaves drafts in the inbox for human agent approval",
  },
];

function PlatformIcon({ domain, label }: { domain: string; label: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external img.logo.dev URL with fallback
    <img
      src={logoUrl(domain)}
      alt={label}
      className="size-7 rounded-md object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function MobilePlatformIcon({ domain, label }: { domain: string; label: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external img.logo.dev URL with fallback
    <img
      src={logoUrl(domain)}
      alt={label}
      className="size-6 rounded-md object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Channel SVG Icons for Brand Authenticity                                   */
/* -------------------------------------------------------------------------- */

function WhatsAppBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.7C8.02 10.92 8.91 12.1 9.03 12.26C9.16 12.43 10.74 14.86 13.17 15.91C13.75 16.16 14.2 16.31 14.55 16.42C15.13 16.61 15.66 16.58 16.08 16.52C16.55 16.45 17.53 15.93 17.73 15.35C17.94 14.78 17.94 14.29 17.88 14.18C17.82 14.07 17.65 14.01 17.4 13.88C17.14 13.76 15.89 13.14 15.66 13.06C15.43 12.97 15.26 12.93 15.09 13.18C14.93 13.43 14.44 14.01 14.29 14.18C14.14 14.36 14 14.38 13.74 14.25C13.49 14.13 12.68 13.86 11.72 13.01C10.97 12.34 10.46 11.52 10.32 11.27C10.17 11.02 10.3 10.88 10.43 10.76C10.54 10.65 10.68 10.47 10.81 10.32C10.94 10.17 10.98 10.07 11.07 9.89C11.15 9.72 11.11 9.57 11.05 9.45C10.98 9.32 10.43 7.97 10.2 7.42C9.98 6.89 9.75 6.96 9.53 7.34Z" />
    </svg>
  );
}

function InstagramBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function MessengerBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.04.57.61.94 1.13.71l1.98-.87c.17-.08.36-.1.55-.06.91.25 1.87.38 2.88.38 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.95 7.46-2.93 4.65c-.47.74-1.48.92-2.17.4l-2.33-1.75a.6.6 0 0 0-.72 0l-3.15 2.39c-.42.32-.97-.18-.69-.63l2.93-4.65c.47-.74 1.48-.92 2.17-.4l2.33 1.75a.6.6 0 0 0 .72 0l3.15-2.39c.42-.32.97.18.69.63z" />
    </svg>
  );
}

function TikTokBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function TelegramBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function SmsBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

function EmailBrandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Component Props                                                            */
/* -------------------------------------------------------------------------- */

interface IntegrationsTabProps {
  embedPlatform: string | null;
  setEmbedPlatform: (p: string | null) => void;
  embedMobilePlatform: string | null;
  setEmbedMobilePlatform: (p: string | null) => void;
  embedScriptCode: string;
  embedIframeCode: string;
  botId: string | null;
  copyToClipboard: (text: string, key: "script" | "iframe" | "mobile") => void;
  copiedScript: boolean;
  copiedMobile: boolean;
  newDomain: string;
  setNewDomain: (d: string) => void;
  allowedDomains: string[];
  setAllowedDomains: (d: string[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleInputChange: (setter: (v: any) => void, val: any) => void;

  // 1. WhatsApp Business Channel
  whatsappEnabled?: boolean;
  setWhatsappEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  whatsappPhoneNumberId?: string;
  setWhatsappPhoneNumberId?: (v: string) => void;
  whatsappWabaId?: string;
  setWhatsappWabaId?: (v: string) => void;
  whatsappAccessToken?: string;
  setWhatsappAccessToken?: (v: string) => void;
  whatsappVerifyToken?: string;
  setWhatsappVerifyToken?: (v: string) => void;
  whatsappAppSecret?: string;
  setWhatsappAppSecret?: (v: string) => void;
  whatsappQuickReplies?: string[];
  setWhatsappQuickReplies?: (v: string[]) => void;
  whatsappConfigured?: boolean;
  setWhatsappConfigured?: (v: boolean) => void;

  // 2. Facebook Messenger Channel
  messengerEnabled?: boolean;
  setMessengerEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  messengerPageId?: string;
  setMessengerPageId?: (v: string) => void;
  messengerPageName?: string;
  setMessengerPageName?: (v: string) => void;
  messengerAccessToken?: string;
  setMessengerAccessToken?: (v: string) => void;
  messengerVerifyToken?: string;
  setMessengerVerifyToken?: (v: string) => void;
  messengerAppSecret?: string;
  setMessengerAppSecret?: (v: string) => void;
  messengerQuickReplies?: string[];
  setMessengerQuickReplies?: (v: string[]) => void;
  messengerConfigured?: boolean;
  setMessengerConfigured?: (v: boolean) => void;

  // 3. Instagram DM Channel
  instagramEnabled?: boolean;
  setInstagramEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  instagramPageId?: string;
  setInstagramPageId?: (v: string) => void;
  instagramUsername?: string;
  setInstagramUsername?: (v: string) => void;
  instagramAccessToken?: string;
  setInstagramAccessToken?: (v: string) => void;
  instagramVerifyToken?: string;
  setInstagramVerifyToken?: (v: string) => void;
  instagramAppSecret?: string;
  setInstagramAppSecret?: (v: string) => void;
  instagramQuickReplies?: string[];
  setInstagramQuickReplies?: (v: string[]) => void;
  instagramConfigured?: boolean;
  setInstagramConfigured?: (v: boolean) => void;

  // 4. TikTok Business Channel
  tiktokEnabled?: boolean;
  setTiktokEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  tiktokOpenId?: string;
  setTiktokOpenId?: (v: string) => void;
  tiktokBusinessId?: string;
  setTiktokBusinessId?: (v: string) => void;
  tiktokDisplayName?: string;
  setTiktokDisplayName?: (v: string) => void;
  tiktokAccessToken?: string;
  setTiktokAccessToken?: (v: string) => void;
  tiktokVerifyToken?: string;
  setTiktokVerifyToken?: (v: string) => void;
  tiktokClientKey?: string;
  setTiktokClientKey?: (v: string) => void;
  tiktokClientSecret?: string;
  setTiktokClientSecret?: (v: string) => void;
  tiktokQuickReplies?: string[];
  setTiktokQuickReplies?: (v: string[]) => void;
  tiktokConfigured?: boolean;
  setTiktokConfigured?: (v: boolean) => void;

  // 5. Telegram Bot Channel
  telegramEnabled?: boolean;
  setTelegramEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  telegramBotToken?: string;
  setTelegramBotToken?: (v: string) => void;
  telegramSecretToken?: string;
  setTelegramSecretToken?: (v: string) => void;
  telegramBotUsername?: string;
  setTelegramBotUsername?: (v: string) => void;
  telegramConfigured?: boolean;
  setTelegramConfigured?: (v: boolean) => void;

  // 6. Twilio SMS Channel
  smsEnabled?: boolean;
  setSmsEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  twilioAccountSid?: string;
  setTwilioAccountSid?: (v: string) => void;
  twilioAuthToken?: string;
  setTwilioAuthToken?: (v: string) => void;
  twilioPhoneNumber?: string;
  setTwilioPhoneNumber?: (v: string) => void;
  smsConfigured?: boolean;
  setSmsConfigured?: (v: boolean) => void;

  // 7. Two-Way Support Email Channel
  emailChannelEnabled?: boolean;
  setEmailChannelEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
  emailSupportAddress?: string;
  setEmailSupportAddress?: (v: string) => void;
  emailWebhookSecret?: string;
  setEmailWebhookSecret?: (v: string) => void;
  emailAutoReplyMode?: "instant_ai" | "draft_copilot";
  setEmailAutoReplyMode?: (v: "instant_ai" | "draft_copilot") => void;
  emailConfigured?: boolean;
  setEmailConfigured?: (v: boolean) => void;

  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
  authToken?: string;
}

export function IntegrationsTab({
  embedPlatform,
  setEmbedPlatform,
  embedMobilePlatform,
  setEmbedMobilePlatform,
  embedScriptCode,
  embedIframeCode,
  botId,
  copyToClipboard,
  copiedScript,
  copiedMobile,
  newDomain,
  setNewDomain,
  allowedDomains,
  setAllowedDomains,
  handleInputChange,
  // WhatsApp
  whatsappEnabled = false,
  setWhatsappEnabled,
  whatsappPhoneNumberId = "",
  setWhatsappPhoneNumberId,
  whatsappWabaId = "",
  setWhatsappWabaId,
  whatsappAccessToken = "",
  setWhatsappAccessToken,
  whatsappVerifyToken = "",
  setWhatsappVerifyToken,
  whatsappAppSecret = "",
  setWhatsappAppSecret,
  whatsappQuickReplies = [],
  setWhatsappQuickReplies,
  whatsappConfigured = false,
  setWhatsappConfigured,
  // Messenger
  messengerEnabled = false,
  setMessengerEnabled,
  messengerPageId = "",
  setMessengerPageId,
  messengerPageName = "",
  setMessengerPageName,
  messengerAccessToken = "",
  setMessengerAccessToken,
  messengerVerifyToken = "",
  setMessengerVerifyToken,
  messengerAppSecret = "",
  setMessengerAppSecret,
  messengerQuickReplies = [],
  setMessengerQuickReplies,
  messengerConfigured = false,
  setMessengerConfigured,
  // Instagram
  instagramEnabled = false,
  setInstagramEnabled,
  instagramPageId = "",
  setInstagramPageId,
  instagramUsername = "",
  setInstagramUsername,
  instagramAccessToken = "",
  setInstagramAccessToken,
  instagramVerifyToken = "",
  setInstagramVerifyToken,
  instagramAppSecret = "",
  setInstagramAppSecret,
  instagramQuickReplies = [],
  setInstagramQuickReplies,
  instagramConfigured = false,
  setInstagramConfigured,
  // TikTok
  tiktokEnabled = false,
  setTiktokEnabled,
  tiktokOpenId = "",
  setTiktokOpenId,
  tiktokBusinessId = "",
  setTiktokBusinessId,
  tiktokDisplayName = "",
  setTiktokDisplayName,
  tiktokAccessToken = "",
  setTiktokAccessToken,
  tiktokVerifyToken = "",
  setTiktokVerifyToken,
  tiktokClientKey = "",
  setTiktokClientKey,
  tiktokClientSecret = "",
  setTiktokClientSecret,
  tiktokQuickReplies = [],
  setTiktokQuickReplies,
  tiktokConfigured = false,
  setTiktokConfigured,
  // Telegram
  telegramEnabled = false,
  setTelegramEnabled,
  telegramBotToken = "",
  setTelegramBotToken,
  telegramSecretToken = "",
  setTelegramSecretToken,
  telegramBotUsername = "",
  setTelegramBotUsername,
  telegramConfigured = false,
  setTelegramConfigured,
  // SMS
  smsEnabled = false,
  setSmsEnabled,
  twilioAccountSid = "",
  setTwilioAccountSid,
  twilioAuthToken = "",
  setTwilioAuthToken,
  twilioPhoneNumber = "",
  setTwilioPhoneNumber,
  smsConfigured = false,
  setSmsConfigured,
  // Email
  emailChannelEnabled = false,
  setEmailChannelEnabled,
  emailSupportAddress = "",
  setEmailSupportAddress,
  emailWebhookSecret = "",
  setEmailWebhookSecret,
  emailAutoReplyMode = "instant_ai",
  setEmailAutoReplyMode,
  emailConfigured = false,
  setEmailConfigured,
  showToast,
  authToken = "",
}: IntegrationsTabProps) {
  const { confirm, confirmationDialog } = useConfirmDialog();

  // Active Omnichannel Channel Tab (7 Global Channels)
  type OmnichannelChannelKey = "whatsapp" | "messenger" | "instagram" | "tiktok" | "telegram" | "sms" | "email";
  const [activeChannel, setActiveChannel] = useState<OmnichannelChannelKey>("whatsapp");

  // Show/Hide Secrets
  const [showWaToken, setShowWaToken] = useState(false);
  const [showWaSecret, setShowWaSecret] = useState(false);
  const [showFbToken, setShowFbToken] = useState(false);
  const [showFbSecret, setShowFbSecret] = useState(false);
  const [showIgToken, setShowIgToken] = useState(false);
  const [showIgSecret, setShowIgSecret] = useState(false);
  const [showTtToken, setShowTtToken] = useState(false);
  const [showTtSecret, setShowTtSecret] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);
  const [showTgSecret, setShowTgSecret] = useState(false);
  const [showSmsToken, setShowSmsToken] = useState(false);
  const [showEmailSecret, setShowEmailSecret] = useState(false);

  // Setup Guides Collapse
  const [showWaGuide, setShowWaGuide] = useState(false);
  const [showFbGuide, setShowFbGuide] = useState(false);
  const [showIgGuide, setShowIgGuide] = useState(false);
  const [showTtGuide, setShowTtGuide] = useState(false);
  const [showTgGuide, setShowTgGuide] = useState(false);
  const [showSmsGuide, setShowSmsGuide] = useState(false);
  const [showEmailGuide, setShowEmailGuide] = useState(false);

  // Copied URLs / Snippets
  const [copiedWaUrl, setCopiedWaUrl] = useState(false);
  const [copiedFbUrl, setCopiedFbUrl] = useState(false);
  const [copiedIgUrl, setCopiedIgUrl] = useState(false);
  const [copiedTtUrl, setCopiedTtUrl] = useState(false);
  const [copiedTgUrl, setCopiedTgUrl] = useState(false);
  const [copiedTgCurl, setCopiedTgCurl] = useState(false);
  const [copiedSmsUrl, setCopiedSmsUrl] = useState(false);
  const [copiedEmailUrl, setCopiedEmailUrl] = useState(false);
  const [copiedVoiceSnippet, setCopiedVoiceSnippet] = useState<string | null>(null);

  // Test / Connect / Disconnect Progress Spinners
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [disconnectingWhatsApp, setDisconnectingWhatsApp] = useState(false);
  const [deauthorizingWhatsApp, setDeauthorizingWhatsApp] = useState(false);

  const [connectingMessenger, setConnectingMessenger] = useState(false);
  const [testingMessenger, setTestingMessenger] = useState(false);
  const [disconnectingMessenger, setDisconnectingMessenger] = useState(false);

  const [connectingInstagram, setConnectingInstagram] = useState(false);
  const [testingInstagram, setTestingInstagram] = useState(false);
  const [disconnectingInstagram, setDisconnectingInstagram] = useState(false);

  const [connectingTiktok, setConnectingTiktok] = useState(false);
  const [testingTiktok, setTestingTiktok] = useState(false);
  const [disconnectingTiktok, setDisconnectingTiktok] = useState(false);

  const [testingTelegram, setTestingTelegram] = useState(false);
  const [registeringTgWebhook, setRegisteringTgWebhook] = useState(false);
  const [disconnectingTelegram, setDisconnectingTelegram] = useState(false);

  const [testingSms, setTestingSms] = useState(false);
  const [disconnectingSms, setDisconnectingSms] = useState(false);

  const [testingEmail, setTestingEmail] = useState(false);
  const [disconnectingEmail, setDisconnectingEmail] = useState(false);

  // Quick Reply Draft Inputs
  const [newQuickReply, setNewQuickReply] = useState("");
  const [newFbQuickReply, setNewFbQuickReply] = useState("");
  const [newIgQuickReply, setNewIgQuickReply] = useState("");
  const [newTtQuickReply, setNewTtQuickReply] = useState("");

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

  // Webhook URLs
  const WA_CALLBACK_URL = `${backendUrl}/webhook/whatsapp`;
  const FB_CALLBACK_URL = `${backendUrl}/webhook/messenger`;
  const IG_CALLBACK_URL = `${backendUrl}/webhook/instagram`;
  const TT_CALLBACK_URL = `${backendUrl}/webhook/tiktok`;
  const TG_CALLBACK_URL = `${backendUrl}/webhook/telegram${botId ? `?bot_id=${encodeURIComponent(botId)}` : ""}`;
  const SMS_CALLBACK_URL = `${backendUrl}/webhook/twilio/sms${botId ? `?bot_id=${encodeURIComponent(botId)}` : ""}`;
  const EMAIL_CALLBACK_URL = `${backendUrl}/webhook/email/inbound${botId ? `?bot_id=${encodeURIComponent(botId)}` : ""}`;

  /* -------------------------------------------------------------------------- */
  /* Connection States Calculation (supports saved backend encrypted state)     */
  /* -------------------------------------------------------------------------- */
  const hasWaToken = Boolean(whatsappAccessToken || whatsappConfigured);
  const isWaConnected = Boolean(whatsappEnabled && (whatsappPhoneNumberId || whatsappConfigured) && hasWaToken);
  const isWaConfigured = Boolean(whatsappPhoneNumberId || whatsappAccessToken || whatsappConfigured);

  const hasFbToken = Boolean(messengerAccessToken || messengerConfigured);
  const isFbConnected = Boolean(messengerEnabled && (messengerPageId || messengerConfigured) && hasFbToken);
  const isFbConfigured = Boolean(messengerPageId || messengerAccessToken || messengerConfigured);

  const hasIgToken = Boolean(instagramAccessToken || instagramConfigured);
  const isIgConnected = Boolean(instagramEnabled && (instagramPageId || instagramConfigured) && hasIgToken);
  const isIgConfigured = Boolean(instagramPageId || instagramAccessToken || instagramConfigured);

  const hasTtToken = Boolean(tiktokAccessToken || tiktokConfigured);
  const isTtConnected = Boolean(tiktokEnabled && (tiktokOpenId || tiktokBusinessId || tiktokConfigured) && hasTtToken);
  const isTtConfigured = Boolean(tiktokOpenId || tiktokBusinessId || tiktokAccessToken || tiktokConfigured);

  const hasTgToken = Boolean(telegramBotToken || telegramConfigured);
  const isTgConnected = Boolean(telegramEnabled && hasTgToken);
  const isTgConfigured = Boolean(telegramBotToken || telegramBotUsername || telegramConfigured);

  const hasSmsToken = Boolean(twilioAuthToken || smsConfigured);
  const isSmsConnected = Boolean(smsEnabled && (twilioAccountSid || smsConfigured) && hasSmsToken && twilioPhoneNumber);
  const isSmsConfigured = Boolean(twilioAccountSid || twilioPhoneNumber || smsConfigured);

  const isEmailConnected = Boolean(emailChannelEnabled && (emailSupportAddress || emailConfigured));
  const isEmailConfigured = Boolean(emailSupportAddress || emailConfigured);

  const activeChannelsCount = [
    isWaConnected,
    isFbConnected,
    isIgConnected,
    isTtConnected,
    isTgConnected,
    isSmsConnected,
    isEmailConnected,
  ].filter(Boolean).length;

  /* -------------------------------------------------------------------------- */
  /* Copy & Secret Helpers                                                      */
  /* -------------------------------------------------------------------------- */
  const copyText = (text: string, setter: (v: boolean) => void, toastMsg: string) => {
    navigator.clipboard?.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
    showToast?.(toastMsg, "success");
  };

  const handleCopyVoice = (code: string, id: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedVoiceSnippet(id);
    setTimeout(() => setCopiedVoiceSnippet(null), 2000);
    showToast?.("Snippet copied to clipboard", "success");
  };

  const generateSecret = (prefix: string) =>
    `${prefix}_` + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);

  /* -------------------------------------------------------------------------- */
  /* Generic Quick-Reply Builder Helper                                         */
  /* -------------------------------------------------------------------------- */
  const addChannelQuickReply = (
    draft: string,
    setDraft: (v: string) => void,
    list: string[],
    setter?: (v: string[]) => void,
    channelLabel = "this channel"
  ) => {
    const trimmed = draft.trim();
    if (!trimmed || !setter) return;
    if (list.length >= 3) {
      showToast?.(`${channelLabel} allows a maximum of 3 quick-reply buttons per message`, "error");
      return;
    }
    if (!list.includes(trimmed)) {
      handleInputChange(setter, [...list, trimmed]);
      setDraft("");
    }
  };

  const removeChannelQuickReply = (btn: string, list: string[], setter?: (v: string[]) => void) => {
    if (!setter) return;
    handleInputChange(
      setter,
      list.filter((b) => b !== btn)
    );
  };

  /* -------------------------------------------------------------------------- */
  /* 1. WhatsApp Actions                                                        */
  /* -------------------------------------------------------------------------- */
  const handleAddQuickReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    addChannelQuickReply(newQuickReply, setNewQuickReply, whatsappQuickReplies, setWhatsappQuickReplies, "WhatsApp");
  };

  const handleRemoveQuickReply = (btn: string) => {
    removeChannelQuickReply(btn, whatsappQuickReplies, setWhatsappQuickReplies);
  };

  const handleConnectWhatsApp = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setConnectingWhatsApp(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/integrations/whatsapp/start?bot_id=${encodeURIComponent(botId)}&redirect_path=${encodeURIComponent("/dashboard?tab=integrations")}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.detail || "Could not start Meta connection");
      window.location.assign(data.url);
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Could not start Meta connection", "error");
      setConnectingWhatsApp(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingWhatsApp(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (whatsappPhoneNumberId) params.append("phone_number_id", whatsappPhoneNumberId);
      if (whatsappAccessToken) params.append("access_token", whatsappAccessToken);
      const response = await fetch(`${backendUrl}/api/integrations/whatsapp/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "WhatsApp connection test failed");
      showToast?.(`${data.verified_name || data.display_phone_number || "WhatsApp"} connection is valid`, "success");
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "WhatsApp connection test failed", "error");
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!botId || !authToken || disconnectingWhatsApp) return;
    if (!(await confirm("Disconnect WhatsApp from this bot and remove its saved Meta credentials?"))) return;
    setDisconnectingWhatsApp(true);
    try {
      const response = await fetch(`${backendUrl}/api/integrations/whatsapp/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "WhatsApp disconnect failed");
      setWhatsappEnabled?.(false);
      setWhatsappPhoneNumberId?.("");
      setWhatsappWabaId?.("");
      setWhatsappAccessToken?.("");
      setWhatsappVerifyToken?.("");
      setWhatsappAppSecret?.("");
      setWhatsappQuickReplies?.([]);
      setWhatsappConfigured?.(false);
      showToast?.("WhatsApp disconnected and credentials removed", "success");
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "WhatsApp disconnect failed", "error");
    } finally {
      setDisconnectingWhatsApp(false);
    }
  };

  const handleDeauthorizeWhatsApp = async () => {
    if (!botId || !authToken || deauthorizingWhatsApp) return;
    if (
      !(await confirm(
        "Revoke Chatty's Meta authorization and disconnect WhatsApp? This affects this app's access and cannot be undone automatically."
      ))
    )
      return;
    setDeauthorizingWhatsApp(true);
    try {
      const response = await fetch(`${backendUrl}/api/integrations/whatsapp/deauthorize?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Meta deauthorization failed");
      setWhatsappEnabled?.(false);
      setWhatsappPhoneNumberId?.("");
      setWhatsappWabaId?.("");
      setWhatsappAccessToken?.("");
      setWhatsappVerifyToken?.("");
      setWhatsappAppSecret?.("");
      setWhatsappQuickReplies?.([]);
      setWhatsappConfigured?.(false);
      showToast?.("Meta authorization revoked and WhatsApp disconnected", "success");
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Meta deauthorization failed", "error");
    } finally {
      setDeauthorizingWhatsApp(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 2. Facebook Messenger Actions                                              */
  /* -------------------------------------------------------------------------- */
  const handleConnectMessenger = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setConnectingMessenger(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/integrations/messenger/start?bot_id=${encodeURIComponent(botId)}&redirect_path=${encodeURIComponent("/dashboard?tab=integrations")}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.detail || "Could not start Facebook Messenger OAuth");
      window.location.assign(data.url);
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Could not start Facebook Messenger OAuth", "error");
      setConnectingMessenger(false);
    }
  };

  const handleTestMessenger = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingMessenger(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (messengerPageId) params.append("page_id", messengerPageId);
      if (messengerAccessToken) params.append("access_token", messengerAccessToken);
      const res = await fetch(`${backendUrl}/api/integrations/messenger/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Facebook Messenger connection test failed");
      if (data.page_name && setMessengerPageName && !messengerPageName) {
        setMessengerPageName(data.page_name);
      }
      showToast?.(data.message || "Facebook Messenger Page connection verified", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Facebook Messenger connection test failed", "error");
    } finally {
      setTestingMessenger(false);
    }
  };

  const handleDisconnectMessenger = async () => {
    if (!botId || !authToken || disconnectingMessenger) return;
    if (!(await confirm("Disconnect Facebook Messenger from this bot and remove its saved Page credentials?"))) return;
    setDisconnectingMessenger(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/messenger/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Messenger disconnect failed");
      setMessengerEnabled?.(false);
      setMessengerPageId?.("");
      setMessengerPageName?.("");
      setMessengerAccessToken?.("");
      setMessengerVerifyToken?.("");
      setMessengerAppSecret?.("");
      setMessengerQuickReplies?.([]);
      setMessengerConfigured?.(false);
      showToast?.("Facebook Messenger disconnected and credentials removed", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Messenger disconnect failed", "error");
    } finally {
      setDisconnectingMessenger(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 3. Instagram Direct Actions                                                */
  /* -------------------------------------------------------------------------- */
  const handleConnectInstagram = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setConnectingInstagram(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/integrations/instagram/start?bot_id=${encodeURIComponent(botId)}&redirect_path=${encodeURIComponent("/dashboard?tab=integrations")}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.detail || "Could not start Instagram OAuth");
      window.location.assign(data.url);
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Could not start Instagram OAuth", "error");
      setConnectingInstagram(false);
    }
  };

  const handleTestInstagram = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingInstagram(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (instagramPageId) params.append("page_id", instagramPageId);
      if (instagramAccessToken) params.append("access_token", instagramAccessToken);
      const res = await fetch(`${backendUrl}/api/integrations/instagram/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Instagram connection test failed");
      if (data.username && setInstagramUsername && !instagramUsername) {
        setInstagramUsername(data.username);
      }
      showToast?.(data.message || "Instagram DM connection verified", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Instagram connection test failed", "error");
    } finally {
      setTestingInstagram(false);
    }
  };

  const handleDisconnectInstagram = async () => {
    if (!botId || !authToken || disconnectingInstagram) return;
    if (!(await confirm("Disconnect Instagram DM from this bot and remove its saved Meta credentials?"))) return;
    setDisconnectingInstagram(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/instagram/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Instagram disconnect failed");
      setInstagramEnabled?.(false);
      setInstagramPageId?.("");
      setInstagramUsername?.("");
      setInstagramAccessToken?.("");
      setInstagramVerifyToken?.("");
      setInstagramAppSecret?.("");
      setInstagramQuickReplies?.([]);
      setInstagramConfigured?.(false);
      showToast?.("Instagram DM disconnected and credentials removed", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Instagram disconnect failed", "error");
    } finally {
      setDisconnectingInstagram(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 4. TikTok Business Actions                                                 */
  /* -------------------------------------------------------------------------- */
  const handleConnectTiktok = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setConnectingTiktok(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/integrations/tiktok/start?bot_id=${encodeURIComponent(botId)}&redirect_path=${encodeURIComponent("/dashboard?tab=integrations")}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.detail || "Could not start TikTok Business OAuth");
      window.location.assign(data.url);
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Could not start TikTok Business OAuth", "error");
      setConnectingTiktok(false);
    }
  };

  const handleTestTiktok = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingTiktok(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (tiktokOpenId) params.append("open_id", tiktokOpenId);
      if (tiktokBusinessId) params.append("business_id", tiktokBusinessId);
      if (tiktokAccessToken) params.append("access_token", tiktokAccessToken);
      const res = await fetch(`${backendUrl}/api/integrations/tiktok/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "TikTok Business connection test failed");
      if (data.display_name && setTiktokDisplayName && !tiktokDisplayName) {
        setTiktokDisplayName(data.display_name);
      }
      showToast?.(data.message || "TikTok Business Messaging connection verified", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "TikTok Business connection test failed", "error");
    } finally {
      setTestingTiktok(false);
    }
  };

  const handleDisconnectTiktok = async () => {
    if (!botId || !authToken || disconnectingTiktok) return;
    if (!(await confirm("Disconnect TikTok Business Messaging from this bot and remove its saved credentials?"))) return;
    setDisconnectingTiktok(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/tiktok/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "TikTok disconnect failed");
      setTiktokEnabled?.(false);
      setTiktokOpenId?.("");
      setTiktokBusinessId?.("");
      setTiktokDisplayName?.("");
      setTiktokAccessToken?.("");
      setTiktokVerifyToken?.("");
      setTiktokClientKey?.("");
      setTiktokClientSecret?.("");
      setTiktokQuickReplies?.([]);
      setTiktokConfigured?.(false);
      showToast?.("TikTok Business Messaging disconnected", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "TikTok disconnect failed", "error");
    } finally {
      setDisconnectingTiktok(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 5. Telegram Bot Actions                                                    */
  /* -------------------------------------------------------------------------- */
  const handleTestTelegram = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingTelegram(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (telegramBotToken) params.append("bot_token", telegramBotToken);
      const res = await fetch(`${backendUrl}/api/integrations/telegram/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Telegram connection test failed");
      if (data.username && setTelegramBotUsername && !telegramBotUsername) {
        setTelegramBotUsername(`@${String(data.username).replace(/^@/, "")}`);
      }
      showToast?.(data.message || "Telegram Bot verified successfully", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Telegram connection test failed", "error");
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleRegisterTelegramWebhook = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    if (!telegramBotToken && !telegramConfigured) {
      showToast?.("Please enter or save your Telegram Bot Token first.", "error");
      return;
    }
    setRegisteringTgWebhook(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/telegram/set-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          bot_id: botId,
          bot_token: telegramBotToken || undefined,
          secret_token: telegramSecretToken || undefined,
          webhook_url: TG_CALLBACK_URL,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Telegram webhook registration failed");
      setTelegramEnabled?.(true);
      setTelegramConfigured?.(true);
      showToast?.(data.message || "Telegram Webhook registered successfully! Bot is live.", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Failed to register Telegram webhook", "error");
    } finally {
      setRegisteringTgWebhook(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!botId || !authToken || disconnectingTelegram) return;
    if (!(await confirm("Disconnect Telegram Bot and clear saved BotFather credentials?"))) return;
    setDisconnectingTelegram(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/telegram/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Telegram disconnect failed");
      setTelegramEnabled?.(false);
      setTelegramBotToken?.("");
      setTelegramSecretToken?.("");
      setTelegramBotUsername?.("");
      setTelegramConfigured?.(false);
      showToast?.("Telegram Bot disconnected", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Telegram disconnect failed", "error");
    } finally {
      setDisconnectingTelegram(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 6. Twilio SMS Actions                                                      */
  /* -------------------------------------------------------------------------- */
  const handleTestSms = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingSms(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (twilioAccountSid) params.append("account_sid", twilioAccountSid);
      if (twilioAuthToken) params.append("auth_token", twilioAuthToken);
      if (twilioPhoneNumber) params.append("phone_number", twilioPhoneNumber);
      const res = await fetch(`${backendUrl}/api/integrations/sms/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Twilio SMS test failed");
      showToast?.(data.message || "Twilio account verified successfully", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Twilio SMS test failed", "error");
    } finally {
      setTestingSms(false);
    }
  };

  const handleDisconnectSms = async () => {
    if (!botId || !authToken || disconnectingSms) return;
    if (!(await confirm("Disconnect Twilio SMS and remove saved Twilio credentials?"))) return;
    setDisconnectingSms(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/sms/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "SMS disconnect failed");
      setSmsEnabled?.(false);
      setTwilioAccountSid?.("");
      setTwilioAuthToken?.("");
      setTwilioPhoneNumber?.("");
      setSmsConfigured?.(false);
      showToast?.("Twilio SMS disconnected", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "SMS disconnect failed", "error");
    } finally {
      setDisconnectingSms(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 7. Two-Way Email Actions                                                   */
  /* -------------------------------------------------------------------------- */
  const handleTestEmail = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setTestingEmail(true);
    try {
      const params = new URLSearchParams({ bot_id: botId });
      if (emailSupportAddress) params.append("support_address", emailSupportAddress);
      const res = await fetch(`${backendUrl}/api/integrations/email/test?${params.toString()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Email inbound routing test failed");
      showToast?.(data.message || "Email routing active", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Email test failed", "error");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!botId || !authToken || disconnectingEmail) return;
    if (!(await confirm("Disconnect Support Email and clear saved inbound forwarding settings?"))) return;
    setDisconnectingEmail(true);
    try {
      const res = await fetch(`${backendUrl}/api/integrations/email/disconnect?bot_id=${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Email disconnect failed");
      setEmailChannelEnabled?.(false);
      setEmailSupportAddress?.("");
      setEmailWebhookSecret?.("");
      setEmailConfigured?.(false);
      showToast?.("Support Email disconnected", "success");
    } catch (err) {
      showToast?.(err instanceof Error ? err.message : "Email disconnect failed", "error");
    } finally {
      setDisconnectingEmail(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Embed Platforms Catalog                                                    */
  /* -------------------------------------------------------------------------- */
  const platforms = [
    { id: "html", label: "HTML", icon: <PlatformIcon domain="w3.org" label="HTML" /> },
    { id: "react", label: "React / Next.js", icon: <PlatformIcon domain="react.dev" label="React" /> },
    { id: "wordpress", label: "WordPress", icon: <PlatformIcon domain="wordpress.org" label="WordPress" />, badge: "Official" },
    { id: "shopify", label: "Shopify", icon: <PlatformIcon domain="shopify.com" label="Shopify" /> },
    { id: "prestashop", label: "Prestashop", icon: <PlatformIcon domain="prestashop.com" label="Prestashop" /> },
    { id: "woocommerce", label: "WooCommerce", icon: <PlatformIcon domain="woocommerce.com" label="WooCommerce" />, badge: "Plugin Ready" },
    { id: "whmcs", label: "WHMCS", icon: <PlatformIcon domain="whmcs.com" label="WHMCS" /> },
    { id: "adobe", label: "Adobe Commerce", icon: <PlatformIcon domain="business.adobe.com" label="Adobe Commerce" /> },
    {
      id: "iframe",
      label: "Inline Embed",
      icon: (
        <svg viewBox="0 0 24 24" className="size-7" fill="none">
          <rect width="24" height="24" rx="5" fill="#6B7280" />
          <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="white" strokeWidth="1.5" />
          <path d="M9 10l-2 2 2 2M15 10l2 2-2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const platformInstructions: Record<
    string,
    {
      title: string;
      badge?: string;
      actionLink?: { label: string; url: string };
      steps: {
        label: string;
        code?: string;
        note?: string;
        link?: { label: string; url: string };
      }[];
    }
  > = {
    html: {
      title: "Add to any HTML page",
      steps: [
        {
          label:
            "Paste this snippet just before the closing </body> tag of your page (mounts as native vector elements via Shadow DOM):",
          code: embedScriptCode,
        },
      ],
    },
    react: {
      title: "Add to React / Next.js",
      steps: [
        {
          label: "Add the script tag to your root layout (e.g. app/layout.tsx):",
          code: `import Script from "next/script";\n\n// Inside your <body>:\n<Script\n  src="https://chatty.personaliai.com/widget.js"\n  data-id="${botId || "YOUR_BOT_ID"}"\n  strategy="afterInteractive"\n/>`,
        },
        {
          label: "For plain React (Vite / CRA), add to your index.html before </body>:",
          code: embedScriptCode,
        },
        {
          label:
            "Renders as native vector DOM elements inside an isolated Shadow Root - zero iframes, 100% sharp at any zoom level.",
        },
      ],
    },
    wordpress: {
      title: "Add to WordPress (Official Plugin Approved)",
      badge: "Official WordPress Plugin",
      actionLink: {
        label: "View on WordPress.org",
        url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
      },
      steps: [
        {
          label: "Install directly from your WordPress Admin Dashboard:",
          note: "Navigate to Plugins → Add New → Search for 'PersonaliAI' → Click 'Install Now' and 'Activate'.",
        },
        {
          label: "Alternatively, download the official plugin from WordPress.org repository:",
          link: {
            label: "wordpress.org/plugins/personaliai-customer-support-chatbot",
            url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
          },
        },
        {
          label: "Enter your Bot ID in WordPress Admin → Settings → PersonaliAI Chatbot:",
          code: botId || "YOUR_BOT_ID",
        },
        {
          label: "Click Save. The AI chatbot is immediately live on your entire WordPress site.",
        },
      ],
    },
    shopify: {
      title: "Add to Shopify",
      steps: [
        {
          label: "Go to Online Store → Themes in your Shopify admin.",
        },
        {
          label: "Click '...' next to your active theme and select 'Edit code'.",
        },
        {
          label: "Open layout/theme.liquid.",
        },
        {
          label: "Paste the snippet right above the closing </body> tag:",
          code: embedScriptCode,
        },
        {
          label: "Click Save.",
        },
      ],
    },
    prestashop: {
      title: "Add to Prestashop",
      steps: [
        {
          label: "Connect to your FTP or file manager.",
        },
        {
          label: "Navigate to /themes/your-theme/templates/_partials/javascript.tpl (or footer.tpl in 1.6).",
        },
        {
          label: "Paste the snippet inside a {literal} block at the bottom:",
          code: `{literal}\n${embedScriptCode}\n{/literal}`,
        },
        {
          label: "Clear Prestashop cache in Advanced Parameters → Performance.",
        },
      ],
    },
    woocommerce: {
      title: "Add to WooCommerce",
      steps: [
        {
          label: "Install the official WordPress plugin (recommended):",
          link: {
            label: "Official WordPress.org Plugin",
            url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
          },
        },
        {
          label: "Or add the script via your child theme's functions.php:",
          code: `add_action('wp_footer', function() {\n?>\n${embedScriptCode}\n<?php\n});`,
        },
      ],
    },
    whmcs: {
      title: "Add to WHMCS",
      steps: [
        {
          label: "Navigate to /templates/{your_active_template}/footer.tpl in your WHMCS installation.",
        },
        {
          label: "Paste the snippet before the closing </body> tag:",
          code: embedScriptCode,
        },
        {
          label: "Save and clear template cache in Setup → General Settings.",
        },
      ],
    },
    adobe: {
      title: "Add to Adobe Commerce / Magento 2",
      steps: [
        {
          label: "In Admin, go to Content → Design → Configuration.",
        },
        {
          label: "Edit your current theme/store view.",
        },
        {
          label: "Scroll to HTML Head → Miscellaneous Scripts, or Footer → Miscellaneous HTML.",
        },
        {
          label: "Paste the snippet:",
          code: embedScriptCode,
        },
        {
          label: "Save Configuration and flush Cache (System → Cache Management).",
        },
      ],
    },
    iframe: {
      title: "Direct Iframe Embed",
      steps: [
        {
          label: "Embed the chat window directly inside an existing section or page:",
          code: embedIframeCode,
        },
      ],
    },
  };

  const selectedPlatform = embedPlatform ? platformInstructions[embedPlatform] : null;

  /* -------------------------------------------------------------------------- */
  /* Mobile SDKs Catalog                                                        */
  /* -------------------------------------------------------------------------- */
  const mobilePlatforms = [
    { id: "ios", label: "iOS (Swift)", icon: <MobilePlatformIcon domain="apple.com" label="iOS" /> },
    { id: "android", label: "Android (Kotlin)", icon: <MobilePlatformIcon domain="android.com" label="Android" /> },
    { id: "react-native", label: "React Native", icon: <MobilePlatformIcon domain="reactnative.dev" label="React Native" /> },
  ];

  const mobileInstructions: Record<
    string,
    {
      title: string;
      steps: {
        label: string;
        code?: string;
        note?: string;
      }[];
    }
  > = {
    ios: {
      title: "iOS SDK (Swift, SwiftUI)",
      steps: [
        {
          label: "Add the package dependency in Xcode (File → Add Package Dependencies):",
          code: `https://github.com/PersonaliAI/chatty-ios-sdk`,
        },
        {
          label: "Import and mount the launcher in your SwiftUI view hierarchy:",
          code: `import SwiftUI\nimport ChattySDK\n\nstruct ContentView: View {\n    var body: some View {\n        ZStack {\n            // your existing app view\n            ChattyLauncher(botId: "${botId || "YOUR_BOT_ID"}")\n        }\n    }\n}`,
        },
        {
          label: "Or present the chat view directly in your own navigation stack:",
          code: `ChattyChatView(botId: "${botId || "YOUR_BOT_ID"}")`,
        },
        { label: "Renders 100% native SwiftUI components - zero WebViews.", note: "Requires iOS 15+." },
      ],
    },
    android: {
      title: "Android SDK (Kotlin, Jetpack Compose)",
      steps: [
        {
          label: "Add JitPack as a repository, then the dependency:",
          code: `// settings.gradle.kts\ndependencyResolutionManagement {\n    repositories {\n        maven { url = uri("https://jitpack.io") }\n    }\n}\n\n// app/build.gradle.kts\ndependencies {\n    implementation("com.github.PersonaliAI:chatty-android-sdk:v1.0.8")\n}`,
        },
        {
          label: "Add a floating launcher to your root composable:",
          code: `@Composable\nfun AppRoot() {\n    Box(Modifier.fillMaxSize()) {\n        // your app content\n        ChattyLauncher(botId = "${botId || "YOUR_BOT_ID"}")\n    }\n}`,
        },
        {
          label: "Or embed a full-screen chat composable directly:",
          code: `ChattyChatScreen(botId = "${botId || "YOUR_BOT_ID"}", modifier = Modifier.fillMaxSize())`,
        },
        { label: "Renders a fully native Jetpack Compose chat UI - no WebView.", note: "Requires minSdk 24+." },
      ],
    },
    "react-native": {
      title: "React Native SDK",
      steps: [
        {
          label: "Install the SDK and its peer dependency:",
          code: `npm install @personaliai/react-native @react-native-async-storage/async-storage`,
        },
        {
          label: "Add a floating launcher anywhere in your app:",
          code: `import { ChattyLauncher } from "@personaliai/react-native";\n\nexport default function App() {\n  return (\n    <>\n      {/* ...your app... */}\n      <ChattyLauncher botId="${botId || "YOUR_BOT_ID"}" position="right" />\n    </>\n  );\n}`,
        },
        {
          label: "Or embed a full-screen chat view directly:",
          code: `import { ChattyChatView } from "@personaliai/react-native";\n\nfunction SupportScreen() {\n  return <ChattyChatView botId="${botId || "YOUR_BOT_ID"}" />;\n}`,
        },
        {
          label: "Renders real React Native components - no WebView - on both iOS and Android.",
          note: "Requires React Native 0.72+.",
        },
      ],
    },
  };

  const mobileSelected = embedMobilePlatform ? mobileInstructions[embedMobilePlatform] : null;

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 flex flex-col gap-6">
      {confirmationDialog}

      {/* Sticky Navigation Bar */}
      <nav
        className="dashboard-action-bar sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-200 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
        aria-label="Integration sections"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {[
            { id: "omnichannel", label: "Omnichannel Hub", badge: "7 Channels" },
            { id: "voice", label: "LiveKit Voice" },
            { id: "embed", label: "Embed & SDKs" },
            { id: "domains", label: "Domain Security" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                document.getElementById(`integration-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="inline-flex items-center gap-1.5 whitespace-nowrap min-h-8 rounded-xl px-3 py-1.5 text-xs font-bold text-neutral-600 transition-colors hover:bg-orange-50 hover:text-orange-700 dark:text-neutral-300 dark:hover:bg-orange-950/30 dark:hover:text-orange-300 cursor-pointer shrink-0"
            >
              <span>{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 text-[9px] font-extrabold px-1.5 py-0.5">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">{activeChannelsCount} of 7 Channels Live</span>
        </div>
      </nav>

      {/* ==================================================================== */}
      {/* SECTION 1: OMNICHANNEL MESSAGING HUB                                 */}
      {/* ==================================================================== */}
      <div
        id="integration-omnichannel"
        className="scroll-mt-24 p-4 sm:p-6 lg:p-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-sm"
      >
        {/* Hub Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-orange-500/10 text-[#f97316] border border-orange-500/20 shadow-xs shrink-0">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                  Omnichannel Messaging Hub
                  <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/20">
                    Industrial Standard
                  </span>
                </h2>
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Unified autonomous conversational infrastructure across 7 enterprise channels: <b>WhatsApp Business</b>, <b>Facebook Messenger</b>, <b>Instagram DM</b>, <b>TikTok Business</b>, <b>Telegram Bot</b>, <b>Two-Way SMS</b>, and <b>Support Email</b>.
              Features cryptographic HMAC validation, interactive quick replies, calendar booking links, and real-time Inbox agent takeover.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 p-2.5 px-3.5 flex items-center gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Active Hub Channels</div>
                <div className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">{activeChannelsCount} of 7 Live</div>
              </div>
              <div className="size-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                ✓
              </div>
            </div>
          </div>
        </div>

        {/* 7 Channel Switcher Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
          {/* 1. WhatsApp */}
          <button
            type="button"
            onClick={() => setActiveChannel("whatsapp")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "whatsapp"
                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-2 ring-emerald-500/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                <WhatsAppBrandIcon className="size-5" />
              </div>
              {isWaConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isWaConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">WhatsApp</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">Cloud API</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">90%+ Open Rate</div>
          </button>

          {/* 2. Facebook Messenger */}
          <button
            type="button"
            onClick={() => setActiveChannel("messenger")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "messenger"
                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs ring-2 ring-blue-600/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <MessengerBrandIcon className="size-5" />
              </div>
              {isFbConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isFbConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">Messenger</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">Page PSID</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-blue-700 dark:text-blue-400 truncate">Meta Graph API</div>
          </button>

          {/* 3. Instagram DM */}
          <button
            type="button"
            onClick={() => setActiveChannel("instagram")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "instagram"
                ? "border-pink-500 bg-pink-50/50 dark:bg-pink-950/20 shadow-xs ring-2 ring-pink-500/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                <InstagramBrandIcon className="size-5" />
              </div>
              {isIgConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isIgConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">Instagram DM</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">D2C & Creators</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-pink-700 dark:text-pink-400 truncate">Buyer Stories DM</div>
          </button>

          {/* 4. TikTok Business */}
          <button
            type="button"
            onClick={() => setActiveChannel("tiktok")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "tiktok"
                ? "border-neutral-950 dark:border-neutral-200 bg-neutral-100/70 dark:bg-neutral-800/60 shadow-xs ring-2 ring-neutral-400/30"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center shrink-0">
                <TikTokBrandIcon className="size-5" />
              </div>
              {isTtConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isTtConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">TikTok DM</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">Business Inbox</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">Commercial API</div>
          </button>

          {/* 5. Telegram */}
          <button
            type="button"
            onClick={() => setActiveChannel("telegram")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "telegram"
                ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-xs ring-2 ring-sky-500/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <TelegramBrandIcon className="size-5" />
              </div>
              {isTgConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isTgConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">Telegram Bot</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">Tech & Startups</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-sky-700 dark:text-sky-400 truncate">@BotFather API</div>
          </button>

          {/* 6. Twilio SMS */}
          <button
            type="button"
            onClick={() => setActiveChannel("sms")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "sms"
                ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 shadow-xs ring-2 ring-red-500/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <SmsBrandIcon className="size-5" />
              </div>
              {isSmsConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isSmsConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">Two-Way SMS</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">US & Canada</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-red-700 dark:text-red-400 truncate">Twilio Carrier</div>
          </button>

          {/* 7. Support Email */}
          <button
            type="button"
            onClick={() => setActiveChannel("email")}
            className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
              activeChannel === "email"
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs ring-2 ring-blue-500/20"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
            }`}
          >
            <div className="flex items-start justify-between gap-1.5">
              <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <EmailBrandIcon className="size-5" />
              </div>
              {isEmailConnected ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="size-1 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : isEmailConfigured ? (
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full">
                  Saved
                </span>
              ) : (
                <span className="text-[9px] font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                  Off
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">Support Email</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">B2B SaaS</div>
            </div>
            <div className="mt-1.5 text-[9px] font-semibold text-blue-700 dark:text-blue-400 truncate">RFC-822 Thread</div>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* ACTIVE CHANNEL WORKSPACE                                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-4 sm:p-6 space-y-6">
          {/* ================================================================ */}
          {/* CHANNEL 1: WHATSAPP BUSINESS                                     */}
          {/* ================================================================ */}
          {activeChannel === "whatsapp" && (
            <div className="space-y-6">
              {/* Channel Header with Status & Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0 border border-[#25D366]/20">
                    <WhatsAppBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        WhatsApp Business (Meta Cloud API)
                      </h3>
                      {isWaConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isWaConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Dominant channel in Europe, LATAM, APAC, South Asia, and Africa. Delivers 90%+ open rates with multimedia, voice audio transcription, and interactive buttons.
                    </p>
                  </div>
                </div>

                {setWhatsappEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable WhatsApp integration"
                      checked={whatsappEnabled}
                      onChange={(e) => handleInputChange(setWhatsappEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-emerald-500"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {whatsappEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* Meta Quick Connect Banner */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Connect with Meta in one step</p>
                  <p className="text-[11px] text-emerald-800/70 dark:text-emerald-300/70 mt-0.5">
                    Authorize your WhatsApp Business Account. Chatty sets up the phone number and webhook automatically.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestWhatsApp}
                    disabled={testingWhatsApp || !botId || (!whatsappPhoneNumberId && !whatsappConfigured)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 disabled:opacity-50 cursor-pointer"
                  >
                    {testingWhatsApp ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingWhatsApp ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectWhatsApp}
                    disabled={connectingWhatsApp || !botId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1fbd5a] disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {connectingWhatsApp ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                    {connectingWhatsApp ? "Connecting…" : isWaConnected ? "Reconnect Meta" : "Connect WhatsApp"}
                  </button>
                  {isWaConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectWhatsApp}
                      disabled={disconnectingWhatsApp}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingWhatsApp ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Meta Webhook Callback URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(WA_CALLBACK_URL, setCopiedWaUrl, "WhatsApp Callback URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedWaUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedWaUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {WA_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  Paste this into Meta Developer Dashboard &rarr; <b>WhatsApp &rarr; Configuration &rarr; Webhook Callback URL</b>.
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Phone Number ID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Phone Number ID</span>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={whatsappPhoneNumberId}
                    onChange={(e) => setWhatsappPhoneNumberId && handleInputChange(setWhatsappPhoneNumberId, e.target.value)}
                    placeholder="e.g. 104859239849201"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">15-digit identifier from Meta WhatsApp API Setup screen.</p>
                </div>

                {/* WABA ID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    WhatsApp Business Account ID (WABA)
                  </label>
                  <input
                    type="text"
                    value={whatsappWabaId}
                    onChange={(e) => setWhatsappWabaId && handleInputChange(setWhatsappWabaId, e.target.value)}
                    placeholder="e.g. 192847291039485"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Business Account ID from Meta Business Manager.</p>
                </div>

                {/* Access Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Permanent Access Token</span>
                    {whatsappConfigured ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Encrypted &amp; Stored</span>
                    ) : (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showWaToken ? "text" : "password"}
                      value={whatsappAccessToken}
                      onChange={(e) => setWhatsappAccessToken && handleInputChange(setWhatsappAccessToken, e.target.value)}
                      placeholder={whatsappConfigured ? "••••••••••••••••••••••••••••••••" : "EAA..."}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(!showWaToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showWaToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">System user token with <code>whatsapp_business_messaging</code>.</p>
                </div>

                {/* Webhook Verify Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Webhook Verify Token</span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("wa");
                        if (setWhatsappVerifyToken) handleInputChange(setWhatsappVerifyToken, token);
                        showToast?.("Generated new WhatsApp Verify Token", "info");
                      }}
                      className="text-[10px] text-orange-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </label>
                  <input
                    type="text"
                    value={whatsappVerifyToken}
                    onChange={(e) => setWhatsappVerifyToken && handleInputChange(setWhatsappVerifyToken, e.target.value)}
                    placeholder="e.g. chatty_wa_secret_12345"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Secret string entered in Meta webhook verification modal.</p>
                </div>

                {/* Meta App Secret */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Key className="size-3.5 text-emerald-500" /> Meta App Secret (HMAC-SHA256 Verification)
                    </span>
                    <span className="text-[10px] text-neutral-400">Recommended for security</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showWaSecret ? "text" : "password"}
                      value={whatsappAppSecret}
                      onChange={(e) => setWhatsappAppSecret && handleInputChange(setWhatsappAppSecret, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaSecret(!showWaSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showWaSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    From Meta App Dashboard &rarr; <b>App settings &rarr; Basic &rarr; App secret</b>. Validates the <code>X-Hub-Signature-256</code> header.
                  </p>
                </div>
              </div>

              {/* Quick-Reply Buttons */}
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-orange-500" /> Interactive Quick-Reply Buttons (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-400">Max 3 buttons (Meta limit)</span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Attach one-tap buttons below AI answers on WhatsApp (e.g. <i>&ldquo;Book a Call&rdquo;</i>, <i>&ldquo;Talk to Human&rdquo;</i>, <i>&ldquo;Pricing&rdquo;</i>).
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  {whatsappQuickReplies.map((btn) => (
                    <span
                      key={btn}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 shadow-2xs"
                    >
                      {btn}
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickReply(btn)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        title="Remove button"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {whatsappQuickReplies.length < 3 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newQuickReply}
                        onChange={(e) => setNewQuickReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddQuickReply();
                          }
                        }}
                        placeholder="Button label..."
                        maxLength={20}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32"
                      />
                      <button
                        type="button"
                        onClick={handleAddQuickReply}
                        disabled={!newQuickReply.trim()}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowWaGuide(!showWaGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Meta Developer Portal Setup Guide</span>
                  {showWaGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showWaGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">1</span>
                      <div><b>Create a Meta App</b>: Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">developers.facebook.com</a> &rarr; My Apps &rarr; Create App &rarr; select <b>Other &rarr; Business</b>.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">2</span>
                      <div><b>Add WhatsApp</b>: Under Add products to your app, click <b>Set up</b> on the WhatsApp card.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">3</span>
                      <div><b>Configure Webhook</b>: Navigate to <b>WhatsApp &rarr; Configuration &rarr; Webhook &rarr; Edit</b>. Paste the <b>Callback URL</b> and <b>Verify Token</b> above, then click <b>Verify and Save</b>.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold">4</span>
                      <div><b>Subscribe to Messages</b>: Under Webhook fields, click <b>Subscribe</b> next to <code>messages</code>.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 2: FACEBOOK MESSENGER                                    */}
          {/* ================================================================ */}
          {activeChannel === "messenger" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-600/20">
                    <MessengerBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Facebook Messenger (Meta Graph API)
                      </h3>
                      {isFbConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isFbConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Autonomous conversational sales and customer service for Facebook Business Pages. Resolves user messages, postback quick replies, and human handoff in real-time.
                    </p>
                  </div>
                </div>

                {setMessengerEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable Facebook Messenger integration"
                      checked={messengerEnabled}
                      onChange={(e) => handleInputChange(setMessengerEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {messengerEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* 1-Click Connect & Test Banner */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200">1-Click Facebook Page Authorization</p>
                  <p className="text-[11px] text-blue-800/70 dark:text-blue-300/70 mt-0.5">
                    Connect your Facebook Page via Meta OAuth or paste your permanent Page Access Token below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestMessenger}
                    disabled={testingMessenger || !botId || (!messengerPageId && !messengerConfigured)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 disabled:opacity-50 cursor-pointer"
                  >
                    {testingMessenger ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingMessenger ? "Testing…" : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectMessenger}
                    disabled={connectingMessenger || !botId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {connectingMessenger ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                    {connectingMessenger ? "Connecting…" : isFbConnected ? "Reconnect Page" : "Connect Messenger"}
                  </button>
                  {isFbConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectMessenger}
                      disabled={disconnectingMessenger}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingMessenger ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-blue-600" /> Facebook Messenger Webhook URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(FB_CALLBACK_URL, setCopiedFbUrl, "Messenger Webhook URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedFbUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedFbUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {FB_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  In Meta Developer Dashboard &rarr; <b>Messenger &rarr; Settings &rarr; Webhooks</b>, subscribe to <code>messages</code> and <code>messaging_postbacks</code>.
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Page ID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Facebook Page ID</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={messengerPageId}
                    onChange={(e) => setMessengerPageId && handleInputChange(setMessengerPageId, e.target.value)}
                    placeholder="e.g. 102938475610293"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Numeric Facebook Page identifier from Page settings.</p>
                </div>

                {/* Page Name */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Page Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={messengerPageName}
                    onChange={(e) => setMessengerPageName && handleInputChange(setMessengerPageName, e.target.value)}
                    placeholder="e.g. Acme Support Page"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Friendly name shown on ticket cards.</p>
                </div>

                {/* Page Access Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Page Access Token</span>
                    {messengerConfigured ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Encrypted &amp; Stored</span>
                    ) : (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showFbToken ? "text" : "password"}
                      value={messengerAccessToken}
                      onChange={(e) => setMessengerAccessToken && handleInputChange(setMessengerAccessToken, e.target.value)}
                      placeholder={messengerConfigured ? "••••••••••••••••••••••••••••••••" : "EAA..."}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFbToken(!showFbToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showFbToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">Page access token with <code>pages_messaging</code> permission.</p>
                </div>

                {/* Webhook Verify Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Webhook Verify Token</span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("fb");
                        if (setMessengerVerifyToken) handleInputChange(setMessengerVerifyToken, token);
                        showToast?.("Generated new Messenger Verify Token", "info");
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </label>
                  <input
                    type="text"
                    value={messengerVerifyToken}
                    onChange={(e) => setMessengerVerifyToken && handleInputChange(setMessengerVerifyToken, e.target.value)}
                    placeholder="e.g. chatty_fb_secret_12345"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Secret token entered in Meta Webhook configuration modal.</p>
                </div>

                {/* Meta App Secret */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Key className="size-3.5 text-blue-600" /> Meta App Secret (HMAC-SHA256 Verification)
                    </span>
                    <span className="text-[10px] text-neutral-400">Recommended for security</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showFbSecret ? "text" : "password"}
                      value={messengerAppSecret}
                      onChange={(e) => setMessengerAppSecret && handleInputChange(setMessengerAppSecret, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFbSecret(!showFbSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showFbSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    From Meta App Dashboard &rarr; <b>App settings &rarr; Basic &rarr; App secret</b>. Validates the <code>X-Hub-Signature-256</code> header.
                  </p>
                </div>
              </div>

              {/* Quick Replies */}
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-blue-600" /> Interactive Quick-Reply Buttons (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-400">Max 3 buttons</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {messengerQuickReplies.map((btn) => (
                    <span
                      key={btn}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 shadow-2xs"
                    >
                      {btn}
                      <button
                        type="button"
                        onClick={() => removeChannelQuickReply(btn, messengerQuickReplies, setMessengerQuickReplies)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        title="Remove button"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {messengerQuickReplies.length < 3 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newFbQuickReply}
                        onChange={(e) => setNewFbQuickReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChannelQuickReply(newFbQuickReply, setNewFbQuickReply, messengerQuickReplies, setMessengerQuickReplies, "Messenger");
                          }
                        }}
                        placeholder="Button label..."
                        maxLength={20}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32"
                      />
                      <button
                        type="button"
                        onClick={() => addChannelQuickReply(newFbQuickReply, setNewFbQuickReply, messengerQuickReplies, setMessengerQuickReplies, "Messenger")}
                        disabled={!newFbQuickReply.trim()}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowFbGuide(!showFbGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Facebook Messenger Setup Guide</span>
                  {showFbGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showFbGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
                      <div><b>Meta Developer Portal</b>: In your Meta App, add the <b>Messenger</b> product.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
                      <div><b>Configure Webhook</b>: Under Messenger &rarr; Webhooks, click <b>Add Callback URL</b>, enter the URL and Verify Token above, and subscribe to <code>messages</code> and <code>messaging_postbacks</code>.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">3</span>
                      <div><b>Generate Token</b>: Under Access Tokens, select your Facebook Page and generate a permanent token. Paste into the fields above.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 3: INSTAGRAM DM                                          */}
          {/* ================================================================ */}
          {activeChannel === "instagram" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0 border border-pink-500/20">
                    <InstagramBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Instagram Direct (Meta Graph API)
                      </h3>
                      {isIgConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isIgConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Direct customer messaging for D2C brands, creators, fashion, clinics, and agencies. Converts inbound buyer inquiries (&ldquo;how much?&rdquo;, &ldquo;is this in stock?&rdquo;) and stories replies automatically.
                    </p>
                  </div>
                </div>

                {setInstagramEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable Instagram DM integration"
                      checked={instagramEnabled}
                      onChange={(e) => handleInputChange(setInstagramEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-pink-600"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {instagramEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* 1-Click Connect & Test Banner */}
              <div className="rounded-xl border border-pink-200 dark:border-pink-900/50 bg-pink-50/70 dark:bg-pink-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-pink-900 dark:text-pink-200">1-Click Instagram Direct Authorization</p>
                  <p className="text-[11px] text-pink-800/70 dark:text-pink-300/70 mt-0.5">
                    Connect your Professional Instagram account via Meta OAuth or enter your Page Access Token below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestInstagram}
                    disabled={testingInstagram || !botId || (!instagramPageId && !instagramConfigured)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-pink-300 dark:border-pink-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-pink-700 dark:text-pink-300 hover:bg-pink-100/70 disabled:opacity-50 cursor-pointer"
                  >
                    {testingInstagram ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingInstagram ? "Testing…" : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectInstagram}
                    disabled={connectingInstagram || !botId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-pink-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {connectingInstagram ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                    {connectingInstagram ? "Connecting…" : isIgConnected ? "Reconnect Instagram" : "Connect Instagram"}
                  </button>
                  {isIgConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectInstagram}
                      disabled={disconnectingInstagram}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingInstagram ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-pink-500" /> Instagram Webhook Callback URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(IG_CALLBACK_URL, setCopiedIgUrl, "Instagram Callback URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedIgUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedIgUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {IG_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  In Meta Developer Dashboard &rarr; <b>Instagram &rarr; Webhooks</b>, subscribe to <code>messages</code> and <code>messaging_postbacks</code>.
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Instagram Page ID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Meta Page ID / Instagram Account ID</span>
                    <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={instagramPageId}
                    onChange={(e) => setInstagramPageId && handleInputChange(setInstagramPageId, e.target.value)}
                    placeholder="e.g. 102938475610293"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Numeric Facebook Page ID or Instagram Business Account ID.</p>
                </div>

                {/* Instagram Username */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Instagram Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={instagramUsername}
                    onChange={(e) => setInstagramUsername && handleInputChange(setInstagramUsername, e.target.value)}
                    placeholder="e.g. yourbrand"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Public profile handle for routing display.</p>
                </div>

                {/* Page Access Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Page Access Token</span>
                    {instagramConfigured ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Encrypted &amp; Stored</span>
                    ) : (
                      <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showIgToken ? "text" : "password"}
                      value={instagramAccessToken}
                      onChange={(e) => setInstagramAccessToken && handleInputChange(setInstagramAccessToken, e.target.value)}
                      placeholder={instagramConfigured ? "••••••••••••••••••••••••••••••••" : "EAA..."}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIgToken(!showIgToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showIgToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Requires <code>pages_messaging</code> and <code>instagram_manage_messages</code>.
                  </p>
                </div>

                {/* Webhook Verify Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Webhook Verify Token</span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("ig");
                        if (setInstagramVerifyToken) handleInputChange(setInstagramVerifyToken, token);
                        showToast?.("Generated new Instagram Verify Token", "info");
                      }}
                      className="text-[10px] text-pink-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </label>
                  <input
                    type="text"
                    value={instagramVerifyToken}
                    onChange={(e) => setInstagramVerifyToken && handleInputChange(setInstagramVerifyToken, e.target.value)}
                    placeholder="e.g. chatty_ig_secret_98765"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Verification string entered in Meta webhook setup modal.</p>
                </div>

                {/* Meta App Secret */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Key className="size-3.5 text-pink-500" /> Meta App Secret (HMAC-SHA256 Verification)
                    </span>
                    <span className="text-[10px] text-neutral-400">Recommended for security</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showIgSecret ? "text" : "password"}
                      value={instagramAppSecret}
                      onChange={(e) => setInstagramAppSecret && handleInputChange(setInstagramAppSecret, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIgSecret(!showIgSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showIgSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    From Meta App Dashboard &rarr; <b>App settings &rarr; Basic &rarr; App secret</b>. Validates the <code>X-Hub-Signature-256</code> header.
                  </p>
                </div>
              </div>

              {/* Quick Replies */}
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-pink-600" /> Interactive Quick-Reply Buttons (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-400">Max 3 buttons</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {instagramQuickReplies.map((btn) => (
                    <span
                      key={btn}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 shadow-2xs"
                    >
                      {btn}
                      <button
                        type="button"
                        onClick={() => removeChannelQuickReply(btn, instagramQuickReplies, setInstagramQuickReplies)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        title="Remove button"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {instagramQuickReplies.length < 3 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newIgQuickReply}
                        onChange={(e) => setNewIgQuickReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChannelQuickReply(newIgQuickReply, setNewIgQuickReply, instagramQuickReplies, setInstagramQuickReplies, "Instagram");
                          }
                        }}
                        placeholder="Button label..."
                        maxLength={20}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32"
                      />
                      <button
                        type="button"
                        onClick={() => addChannelQuickReply(newIgQuickReply, setNewIgQuickReply, instagramQuickReplies, setInstagramQuickReplies, "Instagram")}
                        disabled={!newIgQuickReply.trim()}
                        className="px-2.5 py-1 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-700 disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowIgGuide(!showIgGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Instagram Professional Setup Guide</span>
                  {showIgGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showIgGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">1</span>
                      <div><b>Link Instagram Account</b>: In your Facebook Page settings, ensure your Professional Instagram account is connected to your Page.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">2</span>
                      <div><b>Enable Connected Tools</b>: In Instagram app &rarr; Settings &rarr; Messages and story replies &rarr; Message controls &rarr; Allow access to messages.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white text-[10px] font-bold">3</span>
                      <div><b>Configure Webhook</b>: In Meta Developer Portal &rarr; Instagram &rarr; Webhooks, paste the <b>Callback URL</b> and <b>Verify Token</b> from above. Subscribe to <code>messages</code>.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 4: TIKTOK BUSINESS MESSAGING                              */}
          {/* ================================================================ */}
          {activeChannel === "tiktok" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center shrink-0 border border-neutral-800 dark:border-neutral-200">
                    <TikTokBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        TikTok Business Messaging (Commercial API)
                      </h3>
                      {isTtConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isTtConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Direct messaging for TikTok Shop sellers, viral creators, and e-commerce advertisers. Converts product inquiries, live-stream questions, and video engagements into automated sales.
                    </p>
                  </div>
                </div>

                {setTiktokEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable TikTok Business integration"
                      checked={tiktokEnabled}
                      onChange={(e) => handleInputChange(setTiktokEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-neutral-900 dark:peer-checked:bg-neutral-100"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {tiktokEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* 1-Click Connect & Test Banner */}
              <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-800/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">1-Click TikTok for Business Authorization</p>
                  <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                    Connect via TikTok Business OAuth or provide your TikTok Commercial Access Token below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestTiktok}
                    disabled={testingTiktok || !botId || (!tiktokOpenId && !tiktokBusinessId && !tiktokConfigured)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/70 disabled:opacity-50 cursor-pointer"
                  >
                    {testingTiktok ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingTiktok ? "Testing…" : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectTiktok}
                    disabled={connectingTiktok || !botId}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-3.5 py-2 text-xs font-bold hover:bg-black disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {connectingTiktok ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
                    {connectingTiktok ? "Connecting…" : isTtConnected ? "Reconnect TikTok" : "Connect TikTok"}
                  </button>
                  {isTtConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectTiktok}
                      disabled={disconnectingTiktok}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingTiktok ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-neutral-800 dark:text-neutral-200" /> TikTok Business Webhook URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(TT_CALLBACK_URL, setCopiedTtUrl, "TikTok Webhook URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedTtUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedTtUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {TT_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  In TikTok for Developers &rarr; <b>App &rarr; Webhooks</b>, register this endpoint with your verification token.
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* TikTok Open ID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>TikTok Open ID / Business Account ID</span>
                    <span className="text-[10px] text-neutral-800 dark:text-neutral-200 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={tiktokOpenId}
                    onChange={(e) => setTiktokOpenId && handleInputChange(setTiktokOpenId, e.target.value)}
                    placeholder="e.g. 72648102948201928"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">User or Business Account Open ID from TikTok Developers.</p>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    TikTok Handle / Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={tiktokDisplayName}
                    onChange={(e) => setTiktokDisplayName && handleInputChange(setTiktokDisplayName, e.target.value)}
                    placeholder="e.g. @yourbusiness"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Handle displayed on Inbox ticket cards.</p>
                </div>

                {/* Access Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Business Access Token</span>
                    {tiktokConfigured ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Encrypted &amp; Stored</span>
                    ) : (
                      <span className="text-[10px] text-neutral-800 dark:text-neutral-200 font-bold">Required</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showTtToken ? "text" : "password"}
                      value={tiktokAccessToken}
                      onChange={(e) => setTiktokAccessToken && handleInputChange(setTiktokAccessToken, e.target.value)}
                      placeholder={tiktokConfigured ? "••••••••••••••••••••••••••••••••" : "act.xxxxxx"}
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTtToken(!showTtToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showTtToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">OAuth user access token with <code>business.message</code> scope.</p>
                </div>

                {/* Webhook Verify Token */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Webhook Verify Token</span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("tt");
                        if (setTiktokVerifyToken) handleInputChange(setTiktokVerifyToken, token);
                        showToast?.("Generated new TikTok Verify Token", "info");
                      }}
                      className="text-[10px] text-neutral-800 dark:text-neutral-200 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </label>
                  <input
                    type="text"
                    value={tiktokVerifyToken}
                    onChange={(e) => setTiktokVerifyToken && handleInputChange(setTiktokVerifyToken, e.target.value)}
                    placeholder="e.g. chatty_tt_secret_54321"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Verification string entered in TikTok webhook setup.</p>
                </div>

                {/* TikTok Client Secret */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Key className="size-3.5 text-neutral-800 dark:text-neutral-200" /> TikTok Client Secret (HMAC-SHA256 Signature)
                    </span>
                    <span className="text-[10px] text-neutral-400">Recommended for security</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTtSecret ? "text" : "password"}
                      value={tiktokClientSecret}
                      onChange={(e) => setTiktokClientSecret && handleInputChange(setTiktokClientSecret, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTtSecret(!showTtSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showTtSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    From TikTok Developer App details. Validates the <code>TikTok-Signature</code> or <code>X-TikTok-Signature</code> header.
                  </p>
                </div>
              </div>

              {/* Quick Replies */}
              <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-neutral-800 dark:text-neutral-200" /> Interactive Quick-Reply Buttons (Optional)
                  </label>
                  <span className="text-[10px] text-neutral-400">Max 3 buttons</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {tiktokQuickReplies.map((btn) => (
                    <span
                      key={btn}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 shadow-2xs"
                    >
                      {btn}
                      <button
                        type="button"
                        onClick={() => removeChannelQuickReply(btn, tiktokQuickReplies, setTiktokQuickReplies)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        title="Remove button"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {tiktokQuickReplies.length < 3 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newTtQuickReply}
                        onChange={(e) => setNewTtQuickReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addChannelQuickReply(newTtQuickReply, setNewTtQuickReply, tiktokQuickReplies, setTiktokQuickReplies, "TikTok");
                          }
                        }}
                        placeholder="Button label..."
                        maxLength={20}
                        className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32"
                      />
                      <button
                        type="button"
                        onClick={() => addChannelQuickReply(newTtQuickReply, setNewTtQuickReply, tiktokQuickReplies, setTiktokQuickReplies, "TikTok")}
                        disabled={!newTtQuickReply.trim()}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-medium hover:bg-black disabled:opacity-40 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowTtGuide(!showTtGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step TikTok for Business Messaging Setup Guide</span>
                  {showTtGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showTtGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold">1</span>
                      <div><b>TikTok Developer Portal</b>: Create an App on <a href="https://developers.tiktok.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">developers.tiktok.com</a> and add the Business Messaging product.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold">2</span>
                      <div><b>Register Webhook</b>: Add the Webhook URL and Verify Token above. Check the <code>im.business.message</code> events.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-[10px] font-bold">3</span>
                      <div><b>Save Credentials</b>: Click &quot;Connect TikTok&quot; or copy the Open ID and Access Token into the inputs above and hit Save Changes.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 3: TELEGRAM BOT                                          */}
          {/* ================================================================ */}
          {activeChannel === "telegram" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                    <TelegramBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Telegram Bot (Telegram Bot API 7.0+)
                      </h3>
                      {isTgConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isTgConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Zero phone verification hurdles. Popular with developer tools, crypto, tech startups, and digital products. Takes less than 2 minutes to create via @BotFather.
                    </p>
                  </div>
                </div>

                {setTelegramEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable Telegram bot integration"
                      checked={telegramEnabled}
                      onChange={(e) => handleInputChange(setTelegramEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-sky-500"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {telegramEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* Callout & Test Button */}
              <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                    <span>Inline Keyboard CTAs &amp; Audio Transcripts</span>
                  </div>
                  <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80">
                    Automatically injects <i>&ldquo;📅 Book Appointment&rdquo;</i> buttons directly below answers with HMAC-signed scheduling links.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {telegramBotUsername && (
                    <a
                      href={`https://t.me/${telegramBotUsername.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-white/80 dark:bg-neutral-900/60 px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100/70"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Open t.me</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram || !botId || (!telegramBotToken && !telegramConfigured)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {testingTelegram ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingTelegram ? "Validating…" : "Test Bot Token"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegisterTelegramWebhook}
                    disabled={registeringTgWebhook || !botId || (!telegramBotToken && !telegramConfigured)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Register bot webhook directly with Telegram API"
                  >
                    {registeringTgWebhook ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                    {registeringTgWebhook ? "Registering…" : "Register Webhook"}
                  </button>
                  {isTgConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectTelegram}
                      disabled={disconnectingTelegram}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingTelegram ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-sky-500" /> Telegram Webhook URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(TG_CALLBACK_URL, setCopiedTgUrl, "Telegram Webhook URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedTgUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedTgUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {TG_CALLBACK_URL}
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Bot Token */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Telegram Bot Token</span>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">Required</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTgToken ? "text" : "password"}
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken && handleInputChange(setTelegramBotToken, e.target.value)}
                      placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgToken(!showTgToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showTgToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">Created via Telegram&apos;s official <code>@BotFather</code>.</p>
                </div>

                {/* Secret Token */}
                <div className="space-y-1.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between min-h-[20px]">
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Webhook Secret Token
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("tg");
                        if (setTelegramSecretToken) handleInputChange(setTelegramSecretToken, token);
                        showToast?.("Generated new Telegram Secret Token", "info");
                      }}
                      className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showTgSecret ? "text" : "password"}
                      value={telegramSecretToken}
                      onChange={(e) => setTelegramSecretToken && handleInputChange(setTelegramSecretToken, e.target.value)}
                      placeholder="e.g. tg_secret_string"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTgSecret(!showTgSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showTgSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">Authenticates <code>X-Telegram-Bot-Api-Secret-Token</code>.</p>
                </div>

                {/* Bot Username */}
                <div className="space-y-1.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between min-h-[20px]">
                    <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Bot Username (Optional)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={telegramBotUsername}
                    onChange={(e) => setTelegramBotUsername && handleInputChange(setTelegramBotUsername, e.target.value)}
                    placeholder="e.g. @MySupportBot"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Used for direct <code>t.me/...</code> deep link previews.</p>
                </div>
              </div>

              {/* Webhook Registration Status & 1-Click Action */}
              {(telegramBotToken || telegramConfigured) && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shrink-0">
                        <Zap className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          Automatic Webhook Registration
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Registers the webhook URL directly with Telegram&apos;s Bot API. No terminal or manual cURL commands needed.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRegisterTelegramWebhook}
                      disabled={registeringTgWebhook || !botId || (!telegramBotToken && !telegramConfigured)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-2 text-xs font-bold text-white transition-all shadow-xs disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {registeringTgWebhook ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Registering Webhook…</span>
                        </>
                      ) : (
                        <>
                          <Zap className="size-3.5" />
                          <span>Register Webhook</span>
                        </>
                      )}
                    </button>
                  </div>

                  <details className="text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                    <summary className="cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-300 font-medium select-none">
                      Show manual cURL command (Advanced)
                    </summary>
                    <pre className="mt-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono overflow-x-auto leading-relaxed">
                      {`curl -F "url=${TG_CALLBACK_URL}" ${telegramSecretToken ? `-F "secret_token=${telegramSecretToken}" ` : ""}https://api.telegram.org/bot${telegramBotToken || "<YOUR_TOKEN>"}/setWebhook`}
                    </pre>
                  </details>
                </div>
              )}

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowTgGuide(!showTgGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Telegram @BotFather Setup Guide</span>
                  {showTgGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showTgGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">1</span>
                      <div><b>Open @BotFather</b>: In Telegram, search for <code>@BotFather</code> and send <code>/newbot</code>.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">2</span>
                      <div><b>Name Your Bot</b>: Choose a display name (e.g. &ldquo;Acme Support&rdquo;) and a username ending in <code>bot</code> (e.g. <code>acme_support_bot</code>).</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">3</span>
                      <div><b>Copy HTTP API Token</b>: BotFather will reply with your API token. Paste it into the <b>Telegram Bot Token</b> field above.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white text-[10px] font-bold">4</span>
                      <div><b>Register Webhook</b>: Click <b>Register Webhook</b> above. Chatty will automatically register your bot via Telegram&apos;s API and confirm with a toast.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 4: TWO-WAY SMS (TWILIO)                                  */}
          {/* ================================================================ */}
          {activeChannel === "sms" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-500/20">
                    <SmsBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Two-Way SMS (Twilio / Bird Gateway)
                      </h3>
                      {isSmsConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isSmsConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Carrier-grade SMS messaging for US &amp; Canada. In North America, SMS remains the highest-converting channel for real estate, home services, local clinics, and B2C services.
                    </p>
                  </div>
                </div>

                {setSmsEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable SMS integration"
                      checked={smsEnabled}
                      onChange={(e) => handleInputChange(setSmsEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-red-600"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {smsEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* TCPA Compliance Banner */}
              <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-red-600" />
                    <span>TCPA &amp; CTIA Regulatory Compliance Built-in</span>
                  </div>
                  <p className="text-[11px] text-red-800/80 dark:text-red-300/80">
                    Automated opt-out recognition (<code>STOP</code>, <code>UNSUBSCRIBE</code>, <code>CANCEL</code>) and opt-in restoration (<code>START</code>) with 1,600-character multi-part GSM-7 concatenation.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestSms}
                    disabled={testingSms || !botId || (!twilioAccountSid && !smsConfigured)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100/70 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {testingSms ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingSms ? "Testing…" : "Verify Twilio Account"}
                  </button>
                  {isSmsConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectSms}
                      disabled={disconnectingSms}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingSms ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-red-500" /> Twilio Inbound Messaging Webhook URL
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(SMS_CALLBACK_URL, setCopiedSmsUrl, "Twilio SMS Callback URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedSmsUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedSmsUrl ? "Copied!" : "Copy URL"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {SMS_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  In Twilio Console &rarr; <b>Phone Numbers &rarr; Active Numbers &rarr; Messaging &rarr; A Message Comes In</b>, paste this URL and set HTTP POST.
                </p>
              </div>

              {/* Credentials Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Account SID */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Twilio Account SID</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={twilioAccountSid}
                    onChange={(e) => setTwilioAccountSid && handleInputChange(setTwilioAccountSid, e.target.value)}
                    placeholder="e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Begins with &ldquo;AC&rdquo;, from your Twilio Console dashboard.</p>
                </div>

                {/* Twilio Phone Number */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Twilio Phone Number (E.164)</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Required</span>
                  </label>
                  <input
                    type="text"
                    value={twilioPhoneNumber}
                    onChange={(e) => setTwilioPhoneNumber && handleInputChange(setTwilioPhoneNumber, e.target.value)}
                    placeholder="e.g. +14155552671"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">Your Twilio SMS-enabled phone number with country code.</p>
                </div>

                {/* Auth Token */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Twilio Auth Token (HMAC-SHA1 Verification)</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Required</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSmsToken ? "text" : "password"}
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken && handleInputChange(setTwilioAuthToken, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmsToken(!showSmsToken)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showSmsToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Used to authenticate outbound Twilio REST requests and verify incoming <code>X-Twilio-Signature</code> signatures.
                  </p>
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowSmsGuide(!showSmsGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Twilio Console Setup Guide</span>
                  {showSmsGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showSmsGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">1</span>
                      <div><b>Get a Phone Number</b>: In Twilio Console &rarr; Phone Numbers &rarr; Manage &rarr; Buy a number with SMS capabilities.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">2</span>
                      <div><b>Configure Messaging Webhook</b>: Click your phone number &rarr; Configure &rarr; Under &quot;A Message Comes In&quot;, select <b>Webhook</b> and paste the Webhook URL above. Select <b>HTTP POST</b>.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">3</span>
                      <div><b>Paste Credentials</b>: Copy Account SID and Auth Token from your Twilio Console home screen into the fields above.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* CHANNEL 5: TWO-WAY SUPPORT EMAIL                                 */}
          {/* ================================================================ */}
          {activeChannel === "email" && (
            <div className="space-y-6">
              {/* Channel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="size-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <EmailBrandIcon className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        Two-Way Support Email (Inbound Forwarding)
                      </h3>
                      {isEmailConnected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live &bull; Connected
                        </span>
                      ) : isEmailConfigured ? (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Configured (Disabled)
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          Not Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      The default B2B customer support channel. When an inquiry comes to support@yourdomain.com, Chatty drafts or sends the AI response with full RFC-822 email threading.
                    </p>
                  </div>
                </div>

                {setEmailChannelEnabled && (
                  <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable email support integration"
                      checked={emailChannelEnabled}
                      onChange={(e) => handleInputChange(setEmailChannelEnabled, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-hidden rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-blue-600"></div>
                    <span className="ml-2.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {emailChannelEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                )}
              </div>

              {/* Response Mode Selector & Test */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <span>Smart Threaded Reply &amp; Quoted-Text Stripping</span>
                  </div>
                  <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                    Automatically preserves <code>In-Reply-To</code> and <code>References</code> headers while stripping nested history so customers see clean answers.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testingEmail || !botId || (!emailSupportAddress && !emailConfigured)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {testingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {testingEmail ? "Verifying…" : "Validate Routing"}
                  </button>
                  {isEmailConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnectEmail}
                      disabled={disconnectingEmail}
                      className="inline-flex items-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      {disconnectingEmail ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Webhook Callback Banner */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-blue-500" /> Inbound Email Webhook Endpoint
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(EMAIL_CALLBACK_URL, setCopiedEmailUrl, "Email Inbound URL copied")}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-md hover:bg-neutral-200 cursor-pointer"
                  >
                    {copiedEmailUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    {copiedEmailUrl ? "Copied!" : "Copy Endpoint"}
                  </button>
                </div>
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
                  {EMAIL_CALLBACK_URL}
                </p>
                <p className="text-[10px] text-neutral-400">
                  Target for Resend Inbound, Postmark Inbound Webhook, Cloudflare Email Routing Worker, or SendGrid Inbound Parse.
                </p>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Support Address */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Customer Support Email Address</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Required</span>
                  </label>
                  <input
                    type="email"
                    value={emailSupportAddress}
                    onChange={(e) => setEmailSupportAddress && handleInputChange(setEmailSupportAddress, e.target.value)}
                    placeholder="e.g. support@yourcompany.com"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-400"
                  />
                  <p className="text-[10px] text-neutral-400">The public support address your customers send emails to.</p>
                </div>

                {/* AI Response Mode */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300">
                    AI Response Mode
                  </label>
                  <ModernSelect
                    value={emailAutoReplyMode || "instant_ai"}
                    options={EMAIL_AUTO_REPLY_MODE_OPTIONS}
                    onChange={(val) =>
                      setEmailAutoReplyMode &&
                      handleInputChange(setEmailAutoReplyMode, val as "instant_ai" | "draft_copilot")
                    }
                    size="md"
                    className="w-full text-xs"
                    aria-label="AI Response Mode"
                  />
                  <p className="text-[10px] text-neutral-400">
                    Autonomous replies immediately; Co-Pilot leaves drafts for your agents to review.
                  </p>
                </div>

                {/* Secret Token */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                    <span>Inbound Webhook Secret Token (Authorization Header / X-Webhook-Secret)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const token = generateSecret("em");
                        if (setEmailWebhookSecret) handleInputChange(setEmailWebhookSecret, token);
                        showToast?.("Generated new Email Webhook Secret", "info");
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="size-2.5" /> Generate Secret
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type={showEmailSecret ? "text" : "password"}
                      value={emailWebhookSecret}
                      onChange={(e) => setEmailWebhookSecret && handleInputChange(setEmailWebhookSecret, e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmailSecret(!showEmailSecret)}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showEmailSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Used to authenticate webhook requests from your email delivery service (Resend, Postmark, SendGrid).
                  </p>
                </div>
              </div>

              {/* Setup Guide Accordion */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowEmailGuide(!showEmailGuide)}
                  className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer"
                >
                  <span>Step-by-Step Email Forwarding &amp; Webhook Setup Guide</span>
                  {showEmailGuide ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </button>
                {showEmailGuide && (
                  <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">1</span>
                      <div><b>Resend / Postmark Inbound</b>: In your email provider dashboard, navigate to Inbound Webhooks and paste the <b>Inbound Email Webhook Endpoint</b> above.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">2</span>
                      <div><b>Configure MX Records</b>: Point your inbound subdomain (e.g. <code>inbound.yourcompany.com</code>) to your inbound email parser.</div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">3</span>
                      <div><b>Forwarding Rule</b>: In Google Workspace or Microsoft 365, set an auto-forward rule from <code>support@yourcompany.com</code> to your inbound parser address.</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 2: LIVEKIT VOICE AGENT                                       */}
      {/* ==================================================================== */}
      <div
        id="integration-voice"
        className="scroll-mt-24 p-5 sm:p-7 bg-white dark:bg-neutral-900 border border-violet-200/80 dark:border-violet-900/60 rounded-3xl space-y-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                🎙️
              </span>
              Voice Agent Integration
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Embed a dedicated AI voice assistant on your website. Connects visitors instantly to real-time speech with dynamic audio visualizers, meeting scheduling, product photos, and smooth voice interaction.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/50 px-3 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
            Realtime LiveKit
          </span>
        </div>

        {/* Option 1: Dedicated Script Tag */}
        <div className="rounded-2xl border border-violet-200/80 dark:border-violet-900/70 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <span>Option 1: Dedicated Voice Script Tag (No-Code Embed)</span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                Paste this script before the closing <code>&lt;/body&gt;</code> tag. Adds a floating voice launcher orb to your site that opens straight into the voice assistant.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[11px] font-mono text-neutral-800 dark:text-neutral-200 leading-relaxed">{`<script
  src="https://chatty.personaliai.com/widget.js"
  data-id="${botId || "YOUR_BOT_ID"}"
  data-mode="voice"
  defer
></script>`}</pre>
            <button
              type="button"
              onClick={() =>
                handleCopyVoice(
                  `<script\n  src="https://chatty.personaliai.com/widget.js"\n  data-id="${botId || "YOUR_BOT_ID"}"\n  data-mode="voice"\n  defer\n></script>`,
                  "script"
                )
              }
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer shadow-xs"
            >
              {copiedVoiceSnippet === "script" ? <Check className="size-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="size-3" />}
              {copiedVoiceSnippet === "script" ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-[10px] text-neutral-600 dark:text-neutral-400 pt-1">
            <div className="rounded-lg bg-white/70 dark:bg-neutral-900/70 p-2 border border-neutral-200/60 dark:border-neutral-800">
              <strong className="block font-semibold text-neutral-800 dark:text-neutral-200">data-display=&quot;drawer&quot;</strong>
              <span>Default floating corner drawer with full voice controls.</span>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-neutral-900/70 p-2 border border-neutral-200/60 dark:border-neutral-800">
              <strong className="block font-semibold text-neutral-800 dark:text-neutral-200">data-display=&quot;modal&quot;</strong>
              <span>Centered popup dialog with backdrop blur.</span>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-neutral-900/70 p-2 border border-neutral-200/60 dark:border-neutral-800">
              <strong className="block font-semibold text-neutral-800 dark:text-neutral-200">data-launcher=&quot;none&quot;</strong>
              <span>Headless mode — hides the bubble; trigger via custom buttons.</span>
            </div>
          </div>
        </div>

        {/* Option 2: Custom Website Button Trigger */}
        <div className="rounded-2xl border border-cyan-200/80 dark:border-cyan-900/70 bg-cyan-50/40 dark:bg-cyan-950/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <span>Option 2: Trigger from Any Custom Website Button (JavaScript API)</span>
                <span className="rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 text-[9px] font-bold px-2 py-0.5">
                  Custom CTA
                </span>
              </div>
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                Attach the voice assistant to any existing button, banner, or navigation link on your website using <code>window.Chatty.openVoice()</code>.
              </p>
            </div>
          </div>
          <div className="relative">
            <pre className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[11px] font-mono text-neutral-800 dark:text-neutral-200 leading-relaxed">{`<!-- Custom button anywhere on your site -->
<button onclick="window.Chatty.openVoice()">
  🎙️ Talk with Voice AI
</button>`}</pre>
            <button
              type="button"
              onClick={() =>
                handleCopyVoice(
                  `<!-- Custom button anywhere on your site -->\n<button onclick="window.Chatty.openVoice()">\n  🎙️ Talk with Voice AI\n</button>`,
                  "btn"
                )
              }
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 text-[10px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer shadow-xs"
            >
              {copiedVoiceSnippet === "btn" ? <Check className="size-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="size-3" />}
              {copiedVoiceSnippet === "btn" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap gap-2 text-[10px] text-neutral-500 dark:text-neutral-400 pt-1">
          <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1">Official LiveKit controls</span>
          <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1">5 Audio visualizers</span>
          <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1">Real-time transcript &amp; images</span>
          <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1">In-call meeting booking</span>
          <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1">Smooth adaptive interruption</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION 3: EMBED CHATBOT & CMS INTEGRATIONS                          */}
      {/* ==================================================================== */}
      <div
        id="integration-embed"
        className="scroll-mt-24 p-5 sm:p-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-sm"
      >
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Embed Chatbot on Websites</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Select your website builder or platform to get tailored installation instructions.
          </p>
        </div>

        {/* Platform Selector Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setEmbedPlatform(embedPlatform === p.id ? null : p.id)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                embedPlatform === p.id
                  ? "border-[#f97316] bg-orange-50 dark:bg-orange-950/20"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {p.badge && (
                <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[8px] font-semibold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 leading-none">
                  {p.badge}
                </span>
              )}
              {p.icon}
              <span className="text-[10px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight">
                {p.label}
              </span>
            </button>
          ))}
        </div>

        {/* Selected Platform Instructions */}
        {selectedPlatform && (
          <div className="mt-5 space-y-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 p-4 border border-neutral-200 dark:border-neutral-800">
            <div className="flex max-sm:flex-col max-sm:items-start items-center justify-between max-sm:gap-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{selectedPlatform.title}</h4>
                {selectedPlatform.badge && (
                  <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                    {selectedPlatform.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selectedPlatform.actionLink && (
                  <a
                    href={selectedPlatform.actionLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#f97316] hover:underline"
                  >
                    <span>{selectedPlatform.actionLink.label}</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
                <button
                  onClick={() => setEmbedPlatform(null)}
                  className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer transition-colors"
                >
                  ← Back
                </button>
              </div>
            </div>
            {selectedPlatform.steps.map((step, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#f97316] text-white text-[9px] font-bold mr-1.5">
                    {i + 1}
                  </span>
                  {step.label}
                </p>
                {step.link && (
                  <div className="pl-6 pt-0.5">
                    <a
                      href={step.link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#f97316] hover:underline font-medium"
                    >
                      <span>{step.link.label}</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
                {step.code && (
                  <div className="relative">
                    <pre className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-200 leading-relaxed">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(step.code!, "script")}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer bg-neutral-800 px-2 py-1 rounded-md border border-neutral-700"
                    >
                      {copiedScript ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      {copiedScript ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
                {step.note && (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic pl-6">{step.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 4: MOBILE APP SDKS (IOS / ANDROID / REACT NATIVE)            */}
      {/* ==================================================================== */}
      <div
        id="integration-mobile"
        className="p-5 sm:p-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-6 shadow-sm"
      >
        <div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Embed within Mobile Apps (Native SDKs)</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed max-w-xl">
            Integrate the Chatty SDK into your native app. Renders real native UI components - zero WebViews - talking directly to your bot&apos;s API.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {mobilePlatforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setEmbedMobilePlatform(embedMobilePlatform === p.id ? null : p.id)}
              className={`flex items-center gap-2.5 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                embedMobilePlatform === p.id
                  ? "border-[#f97316] bg-orange-50 dark:bg-orange-950/20"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {p.icon}
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{p.label}</span>
            </button>
          ))}
        </div>

        {mobileSelected && (
          <div className="mt-5 space-y-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 p-4 border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{mobileSelected.title}</h4>
              <button
                onClick={() => setEmbedMobilePlatform(null)}
                className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer transition-colors"
              >
                ← Back
              </button>
            </div>
            {mobileSelected.steps.map((step, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#f97316] text-white text-[9px] font-bold mr-1.5">
                    {i + 1}
                  </span>
                  {step.label}
                </p>
                {step.code && (
                  <div className="relative">
                    <pre className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-200 leading-relaxed">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(step.code!, "mobile")}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer bg-neutral-800 px-2 py-1 rounded-md border border-neutral-700"
                    >
                      {copiedMobile ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      {copiedMobile ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
                {step.note && (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic pl-6">{step.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 5: DOMAIN SECURITY (ALLOWED DOMAINS)                         */}
      {/* ==================================================================== */}
      <div
        id="integration-domains"
        className="scroll-mt-24 p-5 sm:p-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl space-y-4 shadow-sm"
      >
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
            <ShieldAlert className="size-4 text-[#f97316]" /> Allowed Domains Security
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            Restrict where this widget can run. Leave empty to allow <b>any</b> website. Add domains to lock the
            assistant to only your sites - requests from other domains are rejected.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const d = newDomain
              .trim()
              .toLowerCase()
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .replace(/\/.*$/, "")
              .replace(/:\d+$/, "");
            if (d && !allowedDomains.includes(d)) {
              handleInputChange(setAllowedDomains, [...allowedDomains, d]);
            }
            setNewDomain("");
          }}
          className="flex gap-2 pt-2"
        >
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            disabled={!newDomain.trim()}
            className="px-4 py-2 bg-[#f97316] text-white rounded-xl text-xs font-semibold hover:bg-orange-600 cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5" /> Add Domain
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2">
          {allowedDomains.length === 0 ? (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Globe className="size-3.5" /> Open to all domains (no restriction)
            </span>
          ) : (
            allowedDomains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
              >
                {d}
                <button
                  type="button"
                  onClick={() => handleInputChange(setAllowedDomains, allowedDomains.filter((x) => x !== d))}
                  className="text-neutral-400 hover:text-red-500 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
        {allowedDomains.length > 0 && (
          <p className="text-[10px] text-neutral-400 pt-1">
            Click <b>Save Changes</b> in the bottom bar to apply domain restrictions.
          </p>
        )}
      </div>
    </div>
  );
}
