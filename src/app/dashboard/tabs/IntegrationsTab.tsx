"use client";

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
} from "lucide-react";

const LOGO_DEV_TOKEN = "pk_O9y7kfwmQGa93ZxG6XwufQ";

const logoUrl = (domain: string) =>
  `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=80&format=png&retina=true`;

function PlatformIcon({ domain, label }: { domain: string; label: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external img.logo.dev URL (not in next/image's allowlist) with its own onError fallback
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
    // eslint-disable-next-line @next/next/no-img-element -- external img.logo.dev URL (not in next/image's allowlist) with its own onError fallback
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
  // WhatsApp Business Channel
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
  showToast,
  authToken = "",
}: IntegrationsTabProps) {
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState("");
  const [copiedWaUrl, setCopiedWaUrl] = useState(false);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [disconnectingWhatsApp, setDisconnectingWhatsApp] = useState(false);
  const [deauthorizingWhatsApp, setDeauthorizingWhatsApp] = useState(false);

  const WA_CALLBACK_URL = "https://api.chatty.personaliai.com/webhook/whatsapp";

  const handleCopyWaUrl = () => {
    navigator.clipboard?.writeText(WA_CALLBACK_URL);
    setCopiedWaUrl(true);
    setTimeout(() => setCopiedWaUrl(false), 2000);
    if (showToast) showToast("Callback URL copied to clipboard", "success");
  };

  const handleGenerateVerifyToken = () => {
    const randomSecret = "wa_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (setWhatsappVerifyToken) {
      handleInputChange(setWhatsappVerifyToken, randomSecret);
      if (showToast) showToast("Generated new Webhook Verify Token", "info");
    }
  };

  const handleAddQuickReply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newQuickReply.trim();
    if (!trimmed || !setWhatsappQuickReplies) return;
    if (whatsappQuickReplies.length >= 3) {
      if (showToast) showToast("Meta allows maximum 3 quick-reply buttons per message", "error");
      return;
    }
    if (!whatsappQuickReplies.includes(trimmed)) {
      handleInputChange(setWhatsappQuickReplies, [...whatsappQuickReplies, trimmed]);
      setNewQuickReply("");
    }
  };

  const handleRemoveQuickReply = (btn: string) => {
    if (!setWhatsappQuickReplies) return;
    handleInputChange(
      setWhatsappQuickReplies,
      whatsappQuickReplies.filter((b) => b !== btn)
    );
  };

  const isWaConnected = whatsappEnabled && !!whatsappPhoneNumberId && !!whatsappAccessToken;
  const isWaConfigured = !!whatsappPhoneNumberId || !!whatsappAccessToken;

  const handleConnectWhatsApp = async () => {
    if (!botId || !authToken) {
      showToast?.("Your session is still loading. Please try again.", "error");
      return;
    }
    setConnectingWhatsApp(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com"}/api/integrations/whatsapp/start?bot_id=${encodeURIComponent(botId)}&redirect_path=${encodeURIComponent("/dashboard?tab=integrations")}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com"}/api/integrations/whatsapp/test?bot_id=${encodeURIComponent(botId)}`, {
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
    if (!window.confirm("Disconnect WhatsApp from this bot and remove its saved Meta credentials?")) return;
    setDisconnectingWhatsApp(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com"}/api/integrations/whatsapp/disconnect?bot_id=${encodeURIComponent(botId)}`, {
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
      showToast?.("WhatsApp disconnected and credentials removed", "success");
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "WhatsApp disconnect failed", "error");
    } finally {
      setDisconnectingWhatsApp(false);
    }
  };

  const handleDeauthorizeWhatsApp = async () => {
    if (!botId || !authToken || deauthorizingWhatsApp) return;
    if (!window.confirm("Revoke Chatty's Meta authorization and disconnect WhatsApp? This affects this app's access and cannot be undone automatically.")) return;
    setDeauthorizingWhatsApp(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com"}/api/integrations/whatsapp/deauthorize?bot_id=${encodeURIComponent(botId)}`, {
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
      showToast?.("Meta authorization revoked and WhatsApp disconnected", "success");
    } catch (error) {
      showToast?.(error instanceof Error ? error.message : "Meta deauthorization failed", "error");
    } finally {
      setDeauthorizingWhatsApp(false);
    }
  };

  const platforms: { id: string; label: string; icon: React.ReactNode; badge?: string }[] = [
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
          label:
            "Method 1 (Recommended - Official Plugin): In your WordPress admin, navigate to Plugins → Add New Plugin, search for \"PersonaliAI Customer Support Chatbot\", and click Install Now followed by Activate.",
          link: {
            label: "WordPress.org Plugin Directory: personaliai-customer-support-chatbot",
            url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
          },
          note: "Note: Search indexing across WordPress.org can take up to 72 hours following directory approval. You can also download the ZIP package directly from WordPress.org and upload via Plugins → Add New → Upload Plugin.",
        },
        {
          label:
            "In your WordPress sidebar, open Settings → PersonaliAI Chatbot and enter your Bot ID:",
          code: botId || "YOUR_BOT_ID",
          note: "Click Save Changes. Your chatbot will immediately appear live across your WordPress site with zero code editing required.",
        },
        {
          label:
            "Method 2 (Manual Theme Snippet - Alternative without plugin): Paste this hook into your active theme's functions.php:",
          code: `function chatty_widget() { ?>\n${embedScriptCode}\n<?php }\nadd_action('wp_footer', 'chatty_widget');`,
          note: "Alternatively, paste the script snippet into the WPCode / Insert Headers and Footers plugin footer field.",
        },
      ],
    },
    shopify: {
      title: "Add to Shopify",
      steps: [
        { label: "In your Shopify admin go to Online Store → Themes → Edit code." },
        { label: "Open layout/theme.liquid and paste the snippet just before </body>:", code: embedScriptCode },
        { label: "Click Save.", note: "The widget will appear on all storefront pages." },
      ],
    },
    prestashop: {
      title: "Add to Prestashop",
      steps: [
        { label: "Go to Modules → Module Manager → search for Custom HTML." },
        {
          label: "If unavailable, edit your active theme's footer.tpl and paste just before </body>:",
          code: embedScriptCode,
        },
        {
          label: "Clear the Prestashop cache under Advanced Parameters → Performance.",
          note: "Requires FTP access to edit templates directly.",
        },
      ],
    },
    woocommerce: {
      title: "Add to WooCommerce (WordPress)",
      badge: "Official Plugin Ready",
      actionLink: {
        label: "View on WordPress.org",
        url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
      },
      steps: [
        {
          label:
            "Method 1 (Recommended - Official Plugin): Install the official PersonaliAI Customer Support Chatbot plugin directly from WordPress.org:",
          link: {
            label: "WordPress.org: PersonaliAI Customer Support Chatbot",
            url: "https://wordpress.org/plugins/personaliai-customer-support-chatbot",
          },
          note: "Fully compatible with WooCommerce product catalog pages, cart, and checkout.",
        },
        {
          label:
            "In your WordPress sidebar, open Settings → PersonaliAI Chatbot and enter your Bot ID:",
          code: botId || "YOUR_BOT_ID",
          note: "Save Changes. The chatbot will assist shoppers with pre-sale questions, FAQs, and lead capture automatically.",
        },
        {
          label:
            "Method 2 (Manual Theme Snippet): Or add directly to Appearance → Theme File Editor → functions.php:",
          code: `function chatty_widget() { ?>\n${embedScriptCode}\n<?php }\nadd_action('wp_footer', 'chatty_widget');`,
          note: "No WooCommerce-specific coding required.",
        },
      ],
    },
    whmcs: {
      title: "Add to WHMCS",
      steps: [
        { label: "Navigate to your WHMCS template folder: /templates/<your-theme>/footer.tpl" },
        { label: "Paste the snippet just before </body>:", code: embedScriptCode },
        {
          label: "Save and clear the WHMCS template cache.",
          note: "Make sure to replace <your-theme> with your active template name.",
        },
      ],
    },
    adobe: {
      title: "Add to Adobe Commerce (Magento)",
      steps: [
        { label: "In your Magento admin go to Content → Configuration → Edit your store view." },
        {
          label:
            "Under HTML Head → Scripts and Style Sheets, or use a CMS Block / Widget. Alternatively edit app/design/frontend/<Vendor>/<theme>/Magento_Theme/layout/default.xml and add a block referencing a custom .phtml containing:",
          code: embedScriptCode,
        },
        { label: "Run bin/magento cache:flush after saving.", note: "Using a CMS Static Block is the no-deploy option." },
      ],
    },
    iframe: {
      title: "Inline In-Page Embed",
      steps: [
        {
          label: "Paste this embed code wherever you want a full in-page chat window:",
          code: embedIframeCode,
        },
        {
          label: "Adjust width and height attributes to fit your layout.",
          note: "The inline embed renders directly in-page without the floating launcher button.",
        },
      ],
    },
  };

  const selected = embedPlatform ? platformInstructions[embedPlatform] : null;

  const mobilePlatforms = [
    { id: "ios", label: "iOS SDK", icon: <MobilePlatformIcon domain="apple.com" label="iOS" /> },
    { id: "android", label: "Android SDK", icon: <MobilePlatformIcon domain="android.com" label="Android" /> },
    {
      id: "react-native",
      label: "React Native SDK",
      icon: <MobilePlatformIcon domain="reactnative.dev" label="React Native" />,
    },
  ];

  const mobileInstructions: Record<
    string,
    { title: string; steps: { label: string; code?: string; note?: string }[] }
  > = {
    ios: {
      title: "iOS SDK (Swift Package, SwiftUI)",
      steps: [
        {
          label: "In Xcode: File → Add Package Dependencies, paste the URL below and select version 1.0.8:",
          code: `https://github.com/PersonaliAI/chatty-ios-sdk`,
        },
        {
          label: "Add a floating launcher anywhere in your view hierarchy:",
          code: `import ChattySDK\n\nstruct RootView: View {\n    var body: some View {\n        ContentView()\n            .overlay(ChattyLauncher(botId: "${botId || "YOUR_BOT_ID"}"))\n    }\n}`,
        },
        {
          label: "Or embed a full-screen chat screen directly:",
          code: `ChattyChatView(botId: "${botId || "YOUR_BOT_ID"}")`,
        },
        { label: "Renders a fully native SwiftUI chat UI - no WebView.", note: "Requires iOS 15+." },
      ],
    },
    android: {
      title: "Android SDK (Kotlin, Jetpack Compose)",
      steps: [
        {
          label:
            "Add JitPack as a repository, then the dependency (Maven Central also has it, but lags behind at 1.0.0):",
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
    <div className="max-w-4xl mx-auto w-full py-6 px-4 flex flex-col gap-6">
      <nav className="sticky top-2 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95" aria-label="Integration sections">
        {[
          { id: "whatsapp", label: "WhatsApp" },
          { id: "embed", label: "Embed & SDKs" },
          { id: "voice", label: "Voice agent" },
          { id: "domains", label: "Security" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => document.getElementById(`integration-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="min-h-9 flex-1 rounded-xl px-3 py-2 text-[11px] font-bold text-neutral-600 transition-colors hover:bg-orange-50 hover:text-orange-700 dark:text-neutral-300 dark:hover:bg-orange-950/30 dark:hover:text-orange-300 sm:flex-none"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div id="integration-embed" className="order-2 scroll-mt-24 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold">Embed Chatbot</h3>
        <p className="text-xs text-neutral-400 mt-1">
          Select your website builder to get tailored installation instructions.
        </p>

        {/* Platform selector */}
        <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setEmbedPlatform(embedPlatform === p.id ? null : p.id)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer ${
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

        {/* Instructions */}
        {selected && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{selected.title}</h4>
                {selected.badge && (
                  <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                    {selected.badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selected.actionLink && (
                  <a
                    href={selected.actionLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#f97316] hover:underline"
                  >
                    <span>{selected.actionLink.label}</span>
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
            {selected.steps.map((step, i) => (
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
                    <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-350 leading-relaxed">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(step.code!, "script")}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer bg-white dark:bg-neutral-900 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700"
                    >
                      {copiedScript ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
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

      {/* Dedicated voice agent */}
      <div id="integration-voice" className="order-3 scroll-mt-24 p-6 bg-gradient-to-br from-[#fff8f2] to-white dark:from-orange-950/20 dark:to-neutral-900 border border-orange-200/70 dark:border-orange-900/50 rounded-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Talk to voice agent</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Embed the standalone animated call surface with live transcription, microphone activity, mute/hang-up controls, and booking support. It runs independently from the chat widget.
            </p>
          </div>
          <a href={`/voice/${botId || "YOUR_BOT_ID"}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#c67139] px-3 py-1.5 text-[10px] font-semibold text-white hover:opacity-90">
            Preview voice agent <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">Paste this iframe where you want the dedicated call UI:</p>
          <div className="relative">
            <pre className="p-4 rounded-xl bg-neutral-950 text-[10px] font-mono text-neutral-200 overflow-x-auto leading-relaxed">{`<iframe
  src="https://chatty.personaliai.com/voice/${botId || "YOUR_BOT_ID"}"
  title="Talk to our voice agent"
  width="100%" height="760"
  style="border:0;border-radius:24px;overflow:hidden"
  allow="microphone"
></iframe>`}</pre>
            <button onClick={() => copyToClipboard(`<iframe\n  src="https://chatty.personaliai.com/voice/${botId || "YOUR_BOT_ID"}"\n  title="Talk to our voice agent"\n  width="100%" height="760"\n  style="border:0;border-radius:24px;overflow:hidden"\n  allow="microphone"\n></iframe>`, "iframe")} className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white transition-colors cursor-pointer bg-neutral-900 px-2 py-1 rounded-md border border-neutral-700">
              {copiedScript ? <Check className="size-3 text-green-400" /> : <Copy className="size-3" />}
              {copiedScript ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Add the parent site to the bot allow list and keep <code>allow=&quot;microphone&quot;</code> so browsers can grant audio access.</p>
        </div>
      </div>

      {/* Mobile SDKs */}
      <div id="integration-mobile" className="order-3 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold">Embed the widget within your mobile app</h3>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed max-w-xl">
          Enhance and personalize your user experience by integrating the Chatty SDK into your app. Whether you&apos;re using
          iOS, Android, or React Native, the Chatty SDK renders a fully native chat UI - no WebView - talking directly to
          your bot&apos;s API.
        </p>
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mt-5 mb-2.5">Select your option:</p>

        <div className="grid grid-cols-3 gap-2.5">
          {mobilePlatforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setEmbedMobilePlatform(embedMobilePlatform === p.id ? null : p.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                embedMobilePlatform === p.id
                  ? "border-[#f97316] bg-orange-50 dark:bg-orange-950/20"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              {p.icon}
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{p.label}</span>
            </button>
          ))}
        </div>

        {mobileSelected && (
          <div className="mt-5 space-y-4">
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
                    <pre className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-x-auto text-[10px] font-mono text-neutral-700 dark:text-neutral-350 leading-relaxed">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(step.code!, "mobile")}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer bg-white dark:bg-neutral-900 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700"
                    >
                      {copiedMobile ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
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

      {/* WhatsApp Business Channel (Meta Cloud API) */}
      <div id="integration-whatsapp" className="order-1 scroll-mt-24 p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl space-y-6 shadow-sm">
        {/* Header with status badge and toggle switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
              <svg viewBox="0 0 24 24" className="size-6 fill-current">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.7C8.02 10.92 8.91 12.1 9.03 12.26C9.16 12.43 10.74 14.86 13.17 15.91C13.75 16.16 14.2 16.31 14.55 16.42C15.13 16.61 15.66 16.58 16.08 16.52C16.55 16.45 17.53 15.93 17.73 15.35C17.94 14.78 17.94 14.29 17.88 14.18C17.82 14.07 17.65 14.01 17.4 13.88C17.14 13.76 15.89 13.14 15.66 13.06C15.43 12.97 15.26 12.93 15.09 13.18C14.93 13.43 14.44 14.01 14.29 14.18C14.14 14.36 14 14.38 13.74 14.25C13.49 14.13 12.68 13.86 11.72 13.01C10.97 12.34 10.46 11.52 10.32 11.27C10.17 11.02 10.3 10.88 10.43 10.76C10.54 10.65 10.68 10.47 10.81 10.32C10.94 10.17 10.98 10.07 11.07 9.89C11.15 9.72 11.11 9.57 11.05 9.45C10.98 9.32 10.43 7.97 10.2 7.42C9.98 6.89 9.75 6.96 9.53 7.34Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="min-w-0 text-sm font-bold text-neutral-900 dark:text-neutral-100 break-words">
                  WhatsApp Business Integration
                </h3>
                {isWaConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live &bull; Connected
                  </span>
                ) : isWaConfigured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Configured (Disabled)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 border border-neutral-200 dark:border-neutral-700">
                    Not Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed break-words">
                Connect your official Meta WhatsApp Business phone number. Customers receive instant AI answers, and can send text, voice clips, photos, and documents.
              </p>
            </div>
          </div>
          {setWhatsappEnabled && (
            <label className="relative inline-flex items-center cursor-pointer select-none self-start sm:self-auto shrink-0">
              <input
                type="checkbox"
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

        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Connect with Meta in one step</p>
            <p className="text-[11px] text-emerald-800/70 dark:text-emerald-300/70 mt-0.5">Authorize your Business Account and phone number. Chatty will configure the webhook automatically.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestWhatsApp}
              disabled={testingWhatsApp || !botId || !whatsappPhoneNumberId || !whatsappAccessToken}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 disabled:opacity-60 transition-colors"
            >
              {testingWhatsApp ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
              {testingWhatsApp ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              onClick={handleConnectWhatsApp}
              disabled={connectingWhatsApp || !botId}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1fbd5a] disabled:opacity-60 transition-colors"
            >
              {connectingWhatsApp ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
              {connectingWhatsApp ? "Opening Meta…" : isWaConnected ? "Reconnect Meta" : "Connect WhatsApp"}
            </button>
            {isWaConfigured && (
              <>
                <button
                  type="button"
                  onClick={handleDisconnectWhatsApp}
                  disabled={disconnectingWhatsApp || deauthorizingWhatsApp}
                  className="inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/70 bg-white/80 dark:bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition-colors"
                >
                  {disconnectingWhatsApp ? "Disconnecting…" : "Disconnect"}
                </button>
                <button
                  type="button"
                  onClick={handleDeauthorizeWhatsApp}
                  disabled={deauthorizingWhatsApp || disconnectingWhatsApp}
                  className="inline-flex items-center justify-center rounded-lg border border-red-400 dark:border-red-800 bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {deauthorizingWhatsApp ? "Revoking…" : "Revoke Meta access"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Webhook Callback URL banner */}
        <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-emerald-500" /> Meta Webhook Callback URL
            </span>
            <button
              onClick={handleCopyWaUrl}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              {copiedWaUrl ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              {copiedWaUrl ? "Copied!" : "Copy URL"}
            </button>
          </div>
          <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all">
            {WA_CALLBACK_URL}
          </p>
          <p className="text-[10px] text-neutral-400">
            Paste this URL into Meta Developer Dashboard &rarr; <b>WhatsApp &rarr; Configuration &rarr; Webhook Callback URL</b>.
          </p>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Phone Number ID */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex flex-wrap items-center justify-between gap-1">
              <span>Phone Number ID</span>
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">Required</span>
            </label>
            <input
              type="text"
              value={whatsappPhoneNumberId}
              onChange={(e) => setWhatsappPhoneNumberId && handleInputChange(setWhatsappPhoneNumberId, e.target.value)}
              placeholder="e.g. 104859239849201"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
            />
            <p className="text-[10px] text-neutral-400">15-digit identifier from Meta WhatsApp API Setup screen.</p>
          </div>

          {/* WABA ID */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 break-words">
              WhatsApp Business Account ID (WABA)
            </label>
            <input
              type="text"
              value={whatsappWabaId}
              onChange={(e) => setWhatsappWabaId && handleInputChange(setWhatsappWabaId, e.target.value)}
              placeholder="e.g. 192847291039485"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
            />
            <p className="text-[10px] text-neutral-400">Your Business Account ID from Meta Business Manager.</p>
          </div>

          {/* Access Token */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex flex-wrap items-center justify-between gap-1">
              <span>Permanent Access Token</span>
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">Required</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken && handleInputChange(setWhatsappAccessToken, e.target.value)}
                placeholder="EAA..."
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">System User permanent token with <code className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">whatsapp_business_messaging</code>.</p>
          </div>

          {/* Webhook Verify Token */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex flex-wrap items-center justify-between gap-1">
              <span>Webhook Verify Token</span>
              <button
                type="button"
                onClick={handleGenerateVerifyToken}
                className="text-[10px] text-[#f97316] hover:underline font-medium flex items-center gap-1"
              >
                <Sparkles className="size-2.5" /> Generate Secret
              </button>
            </label>
            <input
              type="text"
              value={whatsappVerifyToken}
              onChange={(e) => setWhatsappVerifyToken && handleInputChange(setWhatsappVerifyToken, e.target.value)}
              placeholder="e.g. chatty_wa_secret_12345"
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
            />
            <p className="text-[10px] text-neutral-400">Secret string entered in Meta webhook verification modal.</p>
          </div>

          {/* Meta App Secret */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="font-semibold text-neutral-700 dark:text-neutral-300 flex flex-wrap items-center justify-between gap-1">
              <span className="flex items-center gap-1">
                <Key className="size-3.5 text-emerald-500" /> Meta App Secret (HMAC-SHA256 Verification)
              </span>
              <span className="text-[10px] text-neutral-400">Recommended for security</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={whatsappAppSecret}
                onChange={(e) => setWhatsappAppSecret && handleInputChange(setWhatsappAppSecret, e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 pr-9 text-xs font-mono focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-400">
              From Meta App Dashboard &rarr; <b>App settings &rarr; Basic &rarr; App secret</b>. Used to cryptographically verify the <code className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">X-Hub-Signature-256</code> header.
            </p>
          </div>
        </div>

        {/* Quick-Reply Buttons */}
        <div className="p-4 rounded-xl bg-neutral-50/70 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-[#f97316]" /> Interactive Quick-Reply Buttons (Optional)
            </label>
            <span className="text-[10px] text-neutral-400">Max 3 buttons (Meta limit)</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Attach interactive quick-reply buttons below AI replies on WhatsApp for one-tap navigation (e.g. <i>&ldquo;Book a Call&rdquo;</i>, <i>&ldquo;Talk to Human&rdquo;</i>, <i>&ldquo;Pricing&rdquo;</i>).
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {whatsappQuickReplies.map((btn) => (
              <span
                key={btn}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-200 shadow-2xs"
              >
                {btn}
                <button
                  type="button"
                  onClick={() => handleRemoveQuickReply(btn)}
                  className="text-neutral-400 hover:text-red-500 transition"
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
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none w-32 focus:border-neutral-400"
                />
                <button
                  type="button"
                  onClick={handleAddQuickReply}
                  disabled={!newQuickReply.trim()}
                  className="px-2.5 py-1 rounded-lg bg-[#f97316] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 transition"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Setup Checklist */}
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="w-full flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-950 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
          >
            <span>Step-by-Step Meta Developer Portal Guide</span>
            {showSetupGuide ? <ChevronUp className="size-4 text-neutral-400" /> : <ChevronDown className="size-4 text-neutral-400" />}
          </button>
          {showSetupGuide && (
            <div className="p-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white text-[10px] font-bold">1</span>
                <div>
                  <b>Create a Meta App</b>: Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-[#f97316] hover:underline">developers.facebook.com</a> &rarr; My Apps &rarr; Create App &rarr; select <b>Other &rarr; Business</b>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white text-[10px] font-bold">2</span>
                <div>
                  <b>Add WhatsApp</b>: Under Add products to your app, click <b>Set up</b> on the WhatsApp card.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white text-[10px] font-bold">3</span>
                <div>
                  <b>Configure Webhook</b>: Navigate to <b>WhatsApp &rarr; Configuration &rarr; Webhook &rarr; Edit</b>. Paste the <b>Callback URL</b> and <b>Verify Token</b> from above, then click <b>Verify and Save</b>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white text-[10px] font-bold">4</span>
                <div>
                  <b>Subscribe to Messages</b>: Under Webhook fields, click <b>Subscribe</b> next to <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px]">messages</code>.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f97316] text-white text-[10px] font-bold">5</span>
                <div>
                  <b>System User Token</b>: In Meta Business Settings &rarr; Users &rarr; System Users, generate a permanent token with <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px]">whatsapp_business_messaging</code> and paste it into the <b>Permanent Access Token</b> field above. Click <b>Save Changes</b> below.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security: Allowed Domains */}
      <div id="integration-domains" className="order-4 scroll-mt-24 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <ShieldAlert className="size-4 text-[#f97316]" /> Allowed Domains
        </h3>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
          Restrict where this widget can run. Leave empty to allow <b>any</b> website. Add domains to lock the
          assistant to only your sites - requests from other domains are rejected.
        </p>

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
          className="flex gap-2 mt-4"
        >
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="example.com"
            className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
          />
          <button
            type="submit"
            disabled={!newDomain.trim()}
            className="px-4 py-2 bg-[#f97316] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mt-3">
          {allowedDomains.length === 0 ? (
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Globe className="size-3.5" /> Open to all domains (no restriction)
            </span>
          ) : (
            allowedDomains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                {d}
                <button
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
          <p className="text-[10px] text-neutral-400 mt-3">
            Remember to click <b>Save Changes</b> to apply.
          </p>
        )}
      </div>
    </div>
  );
}
