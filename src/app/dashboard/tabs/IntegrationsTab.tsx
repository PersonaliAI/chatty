"use client";

import { Check, Copy, ShieldAlert, Plus, Globe, X, ExternalLink } from "lucide-react";

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
  handleInputChange: (setter: (v: string[]) => void, val: string[]) => void;
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
}: IntegrationsTabProps) {
  const LOGO_DEV_TOKEN = "pk_O9y7kfwmQGa93ZxG6XwufQ";
  const logoUrl = (domain: string) =>
    `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=80&format=png&retina=true`;
  const PlatformIcon = ({ domain, label }: { domain: string; label: string }) => (
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

  const mobileLogoUrl = (domain: string) =>
    `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=80&format=png&retina=true`;
  const MobilePlatformIcon = ({ domain, label }: { domain: string; label: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- external img.logo.dev URL (not in next/image's allowlist) with its own onError fallback
    <img
      src={mobileLogoUrl(domain)}
      alt={label}
      className="size-6 rounded-md object-contain"
      onError={(e) => {
        (e.target as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
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
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
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

      {/* Mobile SDKs */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
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

      {/* Security: Allowed Domains */}
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
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
