"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  Sparkles,
  Info,
  Send,
  ArrowUp,
  ArrowRight,
  Bot as BotIcon,
  Headphones,
  MessageSquare,
  User,
  Loader2,
  Plus,
  LayoutGrid,
  Upload,
  MessageCircle,
  Phone,
  Bell,
  RefreshCw,
  X,
  MicOff,
  PhoneOff,
  Play,
  Smile,
  Paperclip,
  Mic,
  Check,
  Home,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import {
  getOnColor,
  primaryColorCssVars,
  buildColorSchemeCss,
  type WidgetColorScheme,
} from "@/lib/color-contrast";
import {
  LAUNCHER_STYLES,
  PRESET_SIGNATURES,
  getPresetSignature,
  generatePresetColorScheme,
} from "@/lib/widget-style";
import { SectionPropertyDropdown } from "../dashboard-controls";

const ICON_ONLY_SECTIONS = new Set(["sendBtn", "launcher"]);

interface CustomizerTabProps {
  widgetStyle: string;
  setWidgetStyle: (s: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleInputChange: (setter: (v: any) => void, val: any) => void;
  fontFamily: string | null;
  setFontFamily: (f: string | null) => void;
  fontOptions: ModernSelectOption[];
  fontSizePercent: number;
  setFontSizePercent: (n: number) => void;
  panelSize: string;
  setPanelSize: (s: string) => void;
  voiceMessageMode: "transcribe" | "audio";
  setVoiceMessageMode: (m: "transcribe" | "audio") => void;
  botName: string;
  setBotName: (n: string) => void;
  welcomeMsg: string;
  setWelcomeMsg: (m: string) => void;
  teaserMessage: string;
  setTeaserMessage: (m: string) => void;
  conversationStarters: string[];
  setConversationStarters: (s: string[]) => void;
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  colorScheme: WidgetColorScheme | null;
  setColorScheme: (c: WidgetColorScheme | null) => void;
  sectionColorProp: Record<string, "bg" | "text" | "icon">;
  setSectionColorProp: React.Dispatch<React.SetStateAction<Record<string, "bg" | "text" | "icon">>>;
  sendButtonStyle: string;
  setSendButtonStyle: (s: string) => void;
  avatarIcon: string;
  setAvatarIcon: (i: string) => void;
  logoUrl: string | null;
  logoBgColor: string;
  setLogoBgColor: (c: string) => void;
  avatarFileRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  avatarIconLibrarySelection: unknown;
  setIconPickerOpen: (o: boolean) => void;
  uploadingAvatar: boolean;
  avatarUrl: string | null;
  logoFileRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  uploadingLogo: boolean;
  suggestedColors: string[];
  launcherShape: string;
  setLauncherShape: (s: string) => void;
  previewView: "live" | "chat" | "call";
  setPreviewView: (v: "live" | "chat" | "call") => void;
  dashHeaderLogo: (iconCls: string) => React.ReactNode;
  dashAvatar: (iconCls: string) => React.ReactNode;
  hideBranding: boolean;
  botId?: string | null;
  showSenderTag?: boolean;
  csatEnabled?: boolean;
  fetchWithFallback?: (url: string, options?: RequestInit) => Promise<Response>;
}

export function CustomizerTab({
  widgetStyle,
  setWidgetStyle,
  handleInputChange,
  fontFamily,
  setFontFamily,
  fontOptions,
  fontSizePercent,
  setFontSizePercent,
  panelSize,
  setPanelSize,
  voiceMessageMode,
  setVoiceMessageMode,
  botName,
  setBotName,
  welcomeMsg,
  setWelcomeMsg,
  teaserMessage,
  setTeaserMessage,
  conversationStarters,
  setConversationStarters,
  primaryColor,
  setPrimaryColor,
  colorScheme,
  setColorScheme,
  sectionColorProp,
  setSectionColorProp,
  sendButtonStyle,
  setSendButtonStyle,
  avatarIcon,
  setAvatarIcon,
  logoUrl,
  logoBgColor,
  setLogoBgColor,
  avatarFileRef,
  handleAvatarUpload,
  avatarIconLibrarySelection,
  setIconPickerOpen,
  uploadingAvatar,
  avatarUrl,
  logoFileRef,
  handleLogoUpload,
  uploadingLogo,
  suggestedColors,
  launcherShape,
  setLauncherShape,
  previewView,
  setPreviewView,
  dashHeaderLogo,
  dashAvatar,
  hideBranding,
  botId,
  showSenderTag = false,
  csatEnabled = true,
  fetchWithFallback,
}: CustomizerTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Customizer Panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Design Assistant presets</h3>
            
            {/* Design Presets cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "minimal", name: "Minimal", desc: "Clean SaaS · off-white" },
                { id: "playful", name: "Playful", desc: "Consumer app · rounded & warm" },
                { id: "corporate", name: "Corporate", desc: "Enterprise SaaS · structured navy" },
                { id: "dark-sleek", name: "Dark Sleek", desc: "Dev tool · near-black with glow" },
                { id: "gradient-glow", name: "Gradient Glow", desc: "Startup · vivid gradient" },
                { id: "glassmorphism", name: "Glassmorphism", desc: "Fintech app · frosted glass" },
                { id: "ecommerce", name: "E-commerce", desc: "Online shop · order-aware" },
                { id: "healthcare-calm", name: "Healthcare Calm", desc: "Clinic · soft sage & serif" },
                { id: "neubrutalism", name: "Neubrutalism", desc: "Bold brand · thick borders" },
                { id: "luxury-editorial", name: "Luxury Editorial", desc: "Boutique · serif & gold" },
              ].map((style) => {
                const sig = PRESET_SIGNATURES[style.id];
                const isSelected = widgetStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      const sig = getPresetSignature(style.id);
                      handleInputChange(setWidgetStyle, style.id);
                      handleInputChange(setPrimaryColor, sig.primary);
                      handleInputChange(setFontFamily, sig.fontFamily);
                      handleInputChange(setColorScheme, null);
                    }}
                    className={`p-3 text-left border rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#f97316] bg-[#f97316]/5 ring-1 ring-[#f97316]/30 shadow-xs"
                        : "border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                        {style.name}
                        {isSelected && <span className="size-1.5 rounded-full bg-[#f97316]" />}
                      </div>
                      {sig?.previewPalette && (
                        <div
                          className="flex items-center -space-x-1 shrink-0 p-0.5 rounded hover:ring-1 hover:ring-[#f97316]/40 transition-all cursor-pointer"
                          title={`Click to apply default ${style.name} palette (${sig.primary})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInputChange(setWidgetStyle, style.id);
                            handleInputChange(setPrimaryColor, sig.primary);
                            handleInputChange(setFontFamily, sig.fontFamily);
                            handleInputChange(setColorScheme, null);
                          }}
                        >
                          {sig.previewPalette.map((col, idx) => (
                            <span
                              key={idx}
                              className="size-3 rounded-full border border-black/10 dark:border-white/15 shadow-2xs"
                              style={{ backgroundColor: col }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-neutral-400 leading-normal">{style.desc}</p>
                  </button>
                );
              })}
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800 my-4" />

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Font</label>
              <ModernSelect
                value={fontFamily ?? ""}
                options={fontOptions}
                onChange={(v) => handleInputChange(setFontFamily, v || null)}
              />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                Loaded from Google Fonts. &quot;Design default&quot; keeps the active design preset&apos;s own font.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355">Text Size</label>
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">{fontSizePercent}%</span>
              </div>
              <input
                type="range"
                min={80}
                max={150}
                step={5}
                value={fontSizePercent}
                onChange={(e) => handleInputChange(setFontSizePercent, Number(e.target.value))}
                style={{ "--slider-fill": `${((fontSizePercent - 80) / (150 - 80)) * 100}%` } as React.CSSProperties}
                className="chatty-slider w-full cursor-pointer"
              />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                Scales every text size in the widget together, as a percentage of normal (100%).
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-2">Chat Window Size</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "compact", label: "Compact" },
                  { id: "default", label: "Default" },
                  { id: "large", label: "Large" },
                ] as const).map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => handleInputChange(setPanelSize, size.id)}
                    className={`px-3 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                      panelSize === size.id
                        ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                Starting size of the chat window on desktop. Visitors can still drag the window&apos;s corner to resize it themselves.
              </p>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800 my-4" />

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-2">
                Voice Messages
                <span
                  className="inline-flex text-neutral-400 dark:text-neutral-500 cursor-help"
                  title="Controls what happens when a visitor taps the mic, records, and stops. 'Transcribe & send as text' turns the recording into text they can review and edit before sending. 'Send as audio message' skips that step and delivers the recording itself as a playable voice message."
                >
                  <Info className="size-3.5" />
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleInputChange(setVoiceMessageMode, "transcribe")}
                  className={`px-3 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                    voiceMessageMode === "transcribe"
                      ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
                  }`}
                >
                  Transcribe &amp; send as text
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange(setVoiceMessageMode, "audio")}
                  className={`px-3 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                    voiceMessageMode === "audio"
                      ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-700"
                  }`}
                >
                  Send as audio message
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                {voiceMessageMode === "audio"
                  ? "Recordings are sent as-is, styled to match this design - see the preview."
                  : "Recordings are transcribed to text the visitor can review before sending."}
              </p>
            </div>

            <hr className="border-neutral-100 dark:border-neutral-800 my-4" />

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Chatbot Name</label>
              <input
                type="text"
                value={botName}
                onChange={(e) => handleInputChange(setBotName, e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Welcome Message</label>
              <input
                type="text"
                value={welcomeMsg}
                onChange={(e) => handleInputChange(setWelcomeMsg, e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Teaser Message</label>
              <input
                type="text"
                value={teaserMessage}
                placeholder="👋 Need help? Chat with us."
                onChange={(e) => handleInputChange(setTeaserMessage, e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
              />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Proactive bubble shown next to the launcher a few seconds after a visitor lands.</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Suggested Messages</label>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-2">Tappable starter prompts shown to visitors (up to 4).</p>
              <div className="space-y-2">
                {conversationStarters.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s}
                      placeholder={`e.g. How can you help me?`}
                      onChange={(e) => { const next = [...conversationStarters]; next[i] = e.target.value; handleInputChange(setConversationStarters, next); }}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                    <button
                      type="button"
                      onClick={() => handleInputChange(setConversationStarters, conversationStarters.filter((_, j) => j !== i))}
                      className="px-2 py-1.5 text-neutral-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                      aria-label="Remove suggested message"
                    >✕</button>
                  </div>
                ))}
                {conversationStarters.length < 4 && (
                  <button
                    type="button"
                    onClick={() => handleInputChange(setConversationStarters, [...conversationStarters, ""])}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer transition-colors"
                  >+ Add suggested message</button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355">Primary Hex Color</label>
                {colorScheme && (
                  <button
                    type="button"
                    onClick={() => handleInputChange(setColorScheme, null)}
                    className="text-[10px] text-neutral-400 hover:text-[#f97316] cursor-pointer"
                  >
                    Reset section overrides
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => {
                    const c = e.target.value;
                    handleInputChange(setPrimaryColor, c);
                    if (colorScheme) handleInputChange(setColorScheme, generatePresetColorScheme(widgetStyle, c));
                  }}
                  className="size-8 rounded border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const c = e.target.value;
                    handleInputChange(setPrimaryColor, c);
                    if (colorScheme && /^#[0-9a-fA-F]{6}$/.test(c)) handleInputChange(setColorScheme, generatePresetColorScheme(widgetStyle, c));
                  }}
                  className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                {["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#111827"].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      handleInputChange(setPrimaryColor, color);
                      if (colorScheme) handleInputChange(setColorScheme, generatePresetColorScheme(widgetStyle, color));
                    }}
                    style={{ backgroundColor: color }}
                    className={`size-6 rounded-full border cursor-pointer ${
                      primaryColor === color ? "border-neutral-900 dark:border-white ring-2 ring-[#f97316]/20" : "border-transparent"
                    }`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => handleInputChange(setColorScheme, generatePresetColorScheme(widgetStyle, primaryColor))}
                  className="ml-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-[#f97316]/50 hover:text-[#f97316] cursor-pointer transition-colors flex items-center gap-1"
                  title="Fill every section below from this color using color theory"
                >
                  <Sparkles className="size-3" /> Auto-generate palette
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Quick-sets every section below at once. Each stays individually editable after.</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Section Colors</label>
              <div className="space-y-1.5">
                {(
                  [
                    { key: "header", label: "Header", props: ["bg", "text"] as const },
                    { key: "botBubble", label: "Bot Bubble", props: ["bg", "text"] as const },
                    { key: "userBubble", label: "User Bubble", props: ["bg", "text"] as const },
                    { key: "inputBar", label: "Input Bar", props: ["bg", "text", "icon"] as const },
                    { key: "sendBtn", label: "Send Button", props: ["bg", "text"] as const },
                    { key: "launcher", label: "Launcher Button", props: ["bg", "text"] as const },
                    { key: "avatar", label: "Avatar / Profile", props: ["bg", "text"] as const },
                    { key: "bottomNav", label: "Bottom Bar", props: ["bg", "text"] as const },
                  ] as const
                ).map((section) => {
                  const textPropLabel = ICON_ONLY_SECTIONS.has(section.key) ? "Icon Color" : "Text Color";
                  const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                  const scheme: WidgetColorScheme = {
                    ...defaultScheme,
                    ...(colorScheme || {}),
                    avatar: colorScheme?.avatar || defaultScheme.avatar,
                  };
                  const selectedProp = sectionColorProp[section.key] || "bg";
                  const propLabel = selectedProp === "bg" ? "Background" : selectedProp === "icon" ? "Icon Color" : textPropLabel;
                  const sectionObj = (scheme[section.key as keyof WidgetColorScheme] as unknown as Record<string, string>) ||
                    (defaultScheme[section.key as keyof WidgetColorScheme] as unknown as Record<string, string>) ||
                    {};
                  const currentValue = sectionObj[selectedProp] || (selectedProp === "bg" ? primaryColor : "#ffffff");
                  return (
                    <div key={section.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500 dark:text-neutral-400 w-24 shrink-0 truncate">{section.label}</span>
                      <SectionPropertyDropdown
                        value={selectedProp}
                        options={section.props.map((p) => ({ value: p, label: p === "bg" ? "Background" : p === "icon" ? "Icon Color" : textPropLabel }))}
                        onChange={(v) => setSectionColorProp((prev) => ({ ...prev, [section.key]: v as "bg" | "text" | "icon" }))}
                      />
                      <input
                        type="color"
                        value={currentValue}
                        title={`${section.label} - ${propLabel}`}
                        onChange={(e) => {
                          const next: WidgetColorScheme = {
                            ...scheme,
                            [section.key]: {
                              ...sectionObj,
                              [selectedProp]: e.target.value,
                            },
                          };
                          handleInputChange(setColorScheme, next);
                        }}
                        className="color-swatch-circle size-7 shrink-0 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
              {colorScheme && (
                <button
                  type="button"
                  onClick={() => handleInputChange(setColorScheme, null)}
                  className="mt-2 text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer underline"
                >
                  Reset to design defaults
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Bottom Navigation Bar</label>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-2">Configure navigation dock appearance to match your active design preset.</p>
              
              {/* Style options */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { id: "default", label: "Preset Default", desc: "Native preset dock" },
                  { id: "pill", label: "Floating Pill", desc: "Rounded pill dock" },
                  { id: "chunky", label: "Bold Chunky", desc: "Neubrutal 3px border" },
                  { id: "glass", label: "Frosted Glass", desc: "Frosted blur dock" },
                  { id: "luxury", label: "Luxury Gold", desc: "Espresso & gold hairline" },
                  { id: "clean", label: "Clean Flush", desc: "Minimal borderless" },
                ].map((opt) => {
                  const currentStyle = colorScheme?.bottomNav?.style || "default";
                  const isSelected = currentStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                        const scheme: WidgetColorScheme = { ...defaultScheme, ...(colorScheme || {}) };
                        const next: WidgetColorScheme = {
                          ...scheme,
                          bottomNav: {
                            ...(scheme.bottomNav || defaultScheme.bottomNav || { bg: scheme.botBubble.bg, text: scheme.botBubble.text }),
                            style: opt.id as "default" | "pill" | "clean" | "glass" | "chunky" | "luxury",
                          },
                        };
                        handleInputChange(setColorScheme, next);
                      }}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#f97316] bg-[#f97316]/5 ring-1 ring-[#f97316]/30"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                      }`}
                    >
                      <span className={`text-[11px] font-semibold block truncate ${isSelected ? "text-[#f97316]" : "text-neutral-800 dark:text-neutral-200"}`}>
                        {opt.label}
                      </span>
                      <span className="text-[9px] text-neutral-400 block truncate">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Indicator Picker & Active Color */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                  <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 block mb-1">Active Tab Indicator</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "pill", label: "Pill" },
                      { id: "line", label: "Line" },
                      { id: "dot", label: "Dot" },
                    ].map((ind) => {
                      const presetSig = getPresetSignature(widgetStyle);
                      const currentInd = colorScheme?.bottomNav?.indicator || presetSig.bottomNavIndicator || "pill";
                      const isChosen = currentInd === ind.id;
                      return (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => {
                            const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                            const scheme: WidgetColorScheme = { ...defaultScheme, ...(colorScheme || {}) };
                            const next: WidgetColorScheme = {
                              ...scheme,
                              bottomNav: {
                                ...(scheme.bottomNav || defaultScheme.bottomNav || { bg: scheme.botBubble.bg, text: scheme.botBubble.text }),
                                indicator: ind.id as "line" | "pill" | "dot",
                              },
                            };
                            handleInputChange(setColorScheme, next);
                          }}
                          className={`py-1 text-[10px] font-semibold rounded-md border text-center transition-all cursor-pointer ${
                            isChosen
                              ? "bg-[#f97316] text-white border-[#f97316]"
                              : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          }`}
                        >
                          {ind.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 block">Active Tab Color</span>
                    <span className="text-[9px] text-neutral-400 block">Accent highlight</span>
                  </div>
                  {(() => {
                    const presetSig = getPresetSignature(widgetStyle);
                    const activeVal = colorScheme?.bottomNav?.activeColor || presetSig.bottomNavActive || primaryColor;
                    return (
                      <input
                        type="color"
                        value={activeVal}
                        title="Active Tab Color"
                        onChange={(e) => {
                          const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                          const scheme: WidgetColorScheme = { ...defaultScheme, ...(colorScheme || {}) };
                          const next: WidgetColorScheme = {
                            ...scheme,
                            bottomNav: {
                              ...(scheme.bottomNav || defaultScheme.bottomNav || { bg: scheme.botBubble.bg, text: scheme.botBubble.text }),
                              activeColor: e.target.value,
                            },
                          };
                          handleInputChange(setColorScheme, next);
                        }}
                        className="color-swatch-circle size-7 shrink-0 cursor-pointer"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Label Toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <div className="min-w-0 pr-2">
                  <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 block">Tab Labels</span>
                  <span className="text-[9px] text-neutral-400">Display icon with text, or icons only</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                      const scheme: WidgetColorScheme = { ...defaultScheme, ...(colorScheme || {}) };
                      const next: WidgetColorScheme = {
                        ...scheme,
                        bottomNav: {
                          ...(scheme.bottomNav || defaultScheme.bottomNav || { bg: scheme.botBubble.bg, text: scheme.botBubble.text }),
                          showLabels: true,
                        },
                      };
                      handleInputChange(setColorScheme, next);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors cursor-pointer ${
                      colorScheme?.bottomNav?.showLabels !== false
                        ? "bg-[#f97316] text-white"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    Icon + Label
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultScheme = generatePresetColorScheme(widgetStyle, primaryColor);
                      const scheme: WidgetColorScheme = { ...defaultScheme, ...(colorScheme || {}) };
                      const next: WidgetColorScheme = {
                        ...scheme,
                        bottomNav: {
                          ...(scheme.bottomNav || defaultScheme.bottomNav || { bg: scheme.botBubble.bg, text: scheme.botBubble.text }),
                          showLabels: false,
                        },
                      };
                      handleInputChange(setColorScheme, next);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors cursor-pointer ${
                      colorScheme?.bottomNav?.showLabels === false
                        ? "bg-[#f97316] text-white"
                        : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                  >
                    Icon Only
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Send Button</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "plane", shape: "size-8 rounded-full", icon: <Send className="size-4" /> },
                  { key: "arrowUp", shape: "size-8 rounded-full", icon: <ArrowUp className="size-4" /> },
                  { key: "arrowRight", shape: "size-8 rounded-full", icon: <ArrowRight className="size-4" /> },
                  { key: "square", shape: "size-8 rounded-lg", icon: <Send className="size-4" /> },
                  { key: "label", shape: "h-8 px-3 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleInputChange(setSendButtonStyle, opt.key)}
                    title={opt.key}
                    className={`p-1.5 rounded-xl border cursor-pointer transition-colors ${
                      sendButtonStyle === opt.key
                        ? "border-neutral-900 dark:border-white ring-2 ring-[#f97316]/20"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
                    }`}
                  >
                    <span
                      style={{ backgroundColor: primaryColor, color: getOnColor(primaryColor) }}
                      className={`${opt.shape} flex items-center justify-center`}
                    >
                      {opt.icon}{opt.label && <span className="text-xs font-semibold">{opt.label}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-355 mb-1.5">Assistant Icon</label>
              <div className="flex flex-wrap gap-2">
                {[
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist
                  { key: "logo", node: logoUrl ? <img src={logoUrl} alt="" className="size-5 rounded-full object-cover" /> : <span className="text-xs font-bold">{(botName?.[0] || "C").toUpperCase()}</span> },
                  { key: "bot", node: <BotIcon className="size-4" /> },
                  { key: "headset", node: <Headphones className="size-4" /> },
                  { key: "sparkles", node: <Sparkles className="size-4" /> },
                  { key: "message", node: <MessageSquare className="size-4" /> },
                  { key: "user", node: <User className="size-4" /> },
                ].map((opt) => (
                  <button key={opt.key} type="button" onClick={() => handleInputChange(setAvatarIcon, opt.key)} title={opt.key === "logo" ? "Logo / initial" : opt.key}
                    className={`size-9 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${avatarIcon === opt.key ? "border-[#f97316] ring-2 ring-[#f97316]/20 text-[#f97316]" : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300"}`}>
                    {opt.node}
                  </button>
                ))}
                <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                <button type="button" onClick={() => avatarIconLibrarySelection ? setIconPickerOpen(true) : avatarFileRef.current?.click()} title={avatarIconLibrarySelection ? "Edit this icon" : "Upload custom image"}
                  className={`size-9 rounded-xl border flex items-center justify-center cursor-pointer transition-colors overflow-hidden ${avatarIcon === "custom" ? "border-[#f97316] ring-2 ring-[#f97316]/20" : "border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-[#f97316]/50"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist */}
                  {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : (avatarIcon === "custom" && avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : <Plus className="size-4" />)}
                </button>
                <button type="button" onClick={() => setIconPickerOpen(true)} title="Browse icon library"
                  className="size-9 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-[#f97316]/50 flex items-center justify-center cursor-pointer transition-colors">
                  <LayoutGrid className="size-4" />
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">&quot;Logo&quot; uses your uploaded logo (or the initial). Pick a preset, or upload a custom avatar image (+).</p>
            </div>

            {/* Brand Logo Upload */}
            <div className="mt-1 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-400 mb-1.5">Business / Brand Logo</label>
              <div className="flex items-center gap-4">
                <div 
                  className="size-12 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 overflow-hidden shrink-0 transition-colors"
                  style={logoBgColor ? { backgroundColor: logoBgColor } : {}}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist */}
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="size-full object-cover" /> : <span className="text-sm font-bold text-neutral-400">{(botName?.[0] || "C").toUpperCase()}</span>}
                </div>
                <div>
                  <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <button type="button" onClick={() => logoFileRef.current?.click()} disabled={uploadingLogo}
                    className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 cursor-pointer disabled:opacity-55 flex items-center gap-1.5 transition-colors hover:opacity-90">
                    {uploadingLogo ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Change Logo
                  </button>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">PNG/JPG, max 10 MB. Used as the widget avatar when &quot;Logo&quot; is selected.</p>
                </div>
              </div>

              {/* Brand Logo Background Color Setting */}
              <div className="mt-4">
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-400 mb-1.5">Logo Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={logoBgColor || "#ffffff"}
                    onChange={(e) => handleInputChange(setLogoBgColor, e.target.value)}
                    className="size-8 rounded border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={logoBgColor}
                    placeholder="e.g. #ffffff or transparent"
                    onChange={(e) => handleInputChange(setLogoBgColor, e.target.value)}
                    className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                  />
                  {logoBgColor && (
                    <button
                      type="button"
                      onClick={() => handleInputChange(setLogoBgColor, "")}
                      className="text-[10px] text-red-500 hover:underline shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Color Suggestions */}
              {suggestedColors.length > 0 && (
                <div className="mt-4">
                  <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-400 mb-1.5 font-medium">Suggested Colors (from Logo)</label>
                  <div className="flex flex-wrap gap-2.5">
                    {suggestedColors.map((color) => (
                      <div key={color} className="flex flex-col items-center gap-1 p-1.5 border border-neutral-200 dark:border-neutral-850 rounded-xl bg-neutral-50/50 dark:bg-neutral-950/50">
                        <div 
                          className="w-7 h-7 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-sm transition-transform hover:scale-105"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                        <span className="text-[8px] font-mono text-neutral-500 dark:text-neutral-400">{color.toUpperCase()}</span>
                        <div className="flex gap-1 mt-1">
                          <button 
                            type="button" 
                            onClick={() => handleInputChange(setPrimaryColor, color)}
                            title="Set as Widget Primary Color"
                            className="px-1 py-0.5 text-[8px] font-semibold rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-85 cursor-pointer"
                          >
                            Primary
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleInputChange(setLogoBgColor, color)}
                            title="Set as Logo Background Color"
                            className="px-1 py-0.5 text-[8px] font-semibold rounded border border-neutral-350 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                          >
                            Logo BG
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avatar Background Color Setting */}
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-400 mb-1.5">Avatar / Profile Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorScheme?.avatar?.bg || primaryColor}
                    onChange={(e) => {
                      const scheme: WidgetColorScheme = { ...generatePresetColorScheme(widgetStyle, primaryColor), ...(colorScheme || {}) };
                      const next = { ...scheme, avatar: { bg: e.target.value, text: scheme.avatar?.text || getOnColor(e.target.value) } };
                      handleInputChange(setColorScheme, next);
                    }}
                    className="size-8 rounded border border-neutral-200 bg-transparent p-0.5 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={colorScheme?.avatar?.bg || ""}
                    placeholder={`e.g. ${primaryColor} (defaults to primary)`}
                    onChange={(e) => {
                      const scheme: WidgetColorScheme = { ...generatePresetColorScheme(widgetStyle, primaryColor), ...(colorScheme || {}) };
                      const next = { ...scheme, avatar: { bg: e.target.value, text: scheme.avatar?.text || getOnColor(e.target.value || primaryColor) } };
                      handleInputChange(setColorScheme, next);
                    }}
                    className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                  />
                  {colorScheme?.avatar?.bg && (
                    <button
                      type="button"
                      onClick={() => {
                        if (colorScheme) {
                          const { avatar: _, ...rest } = colorScheme;
                          handleInputChange(setColorScheme, rest);
                        }
                      }}
                      className="text-[10px] text-red-500 hover:underline shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                  Sets the background color for profile avatars and transparent brand logos across header, cards, and chats.
                </p>
              </div>

              {/* Launcher Button Shape */}
              <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-450 mb-1.5">Launcher Button Shape</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "circle", name: "Circle", radiusClass: "rounded-full" },
                    { key: "bubble", name: "WhatsApp Bubble", radiusClass: "rounded-3xl rounded-br-sm" },
                    { key: "rounded", name: "Rounded Square", radiusClass: "rounded-xl" },
                    { key: "square", name: "Square", radiusClass: "rounded-none" },
                  ].map((shape) => (
                    <button
                      key={shape.key}
                      type="button"
                      onClick={() => handleInputChange(setLauncherShape, shape.key)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                        launcherShape === shape.key
                          ? "border-[#f97316] bg-[#f97316]/5 text-[#f97316] font-bold"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-350"
                      }`}
                    >
                      <span 
                        className={`w-3.5 h-3.5 border border-current ${shape.radiusClass} bg-current opacity-70 shrink-0`}
                      />
                      {shape.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
                  Select the outer shape of the floating chat button. &quot;WhatsApp Bubble&quot; automatically mirrors if the launcher position is set to the left.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Live visual mockup preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold mb-3">Live Assistant Preview</span>
          <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-0.5 mb-3">
            {([
              { value: "live" as const, label: "Live Widget", icon: LayoutGrid },
              { value: "chat" as const, label: "Mockup", icon: MessageCircle },
              { value: "call" as const, label: "Call", icon: Phone },
            ]).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setPreviewView(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                  previewView === t.value
                    ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <t.icon className="size-3" /> {t.label}
              </button>
            ))}
          </div>

          {previewView === "live" ? (
            botId ? (
              <div className="w-full flex flex-col items-center">
                <iframe
                  key={`${botId}-${primaryColor}-${widgetStyle}-${avatarIcon}-${logoUrl}-${logoBgColor}-${botName}-${showSenderTag}-${csatEnabled}-${JSON.stringify(colorScheme)}-${fontFamily}-${fontSizePercent}`}
                  src={`/embed/${botId}?preview=true&color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}&name=${encodeURIComponent(botName)}&welcome=${encodeURIComponent(welcomeMsg)}&avatar_icon=${avatarIcon}&avatar_url=${encodeURIComponent(avatarUrl || "")}&logo_url=${encodeURIComponent(logoUrl || "")}&logo_bg_color=${encodeURIComponent(logoBgColor || "")}&show_sender_tag=${showSenderTag}&csat_enabled=${csatEnabled}&color_scheme=${encodeURIComponent(colorScheme ? JSON.stringify(colorScheme) : "")}&font=${encodeURIComponent(fontFamily || "")}&font_size_percent=${fontSizePercent}`}
                  title="Live widget preview"
                  className="w-full max-w-[380px] h-[550px] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-lg bg-white dark:bg-neutral-900"
                />
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2 text-center">
                  Live preview · reflects your current settings in real time.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-[380px] h-[550px] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs text-neutral-400">
                Save your bot to preview the live widget.
              </div>
            )
          ) : (
            <>
              <style>{`#customizer-live-preview { box-shadow: none !important; }\n${buildColorSchemeCss(colorScheme, "#customizer-live-preview")}\n${
                fontFamily && /^[a-zA-Z0-9 -]+$/.test(fontFamily)
                  ? `#customizer-live-preview { font-family: "${fontFamily}", sans-serif !important; }`
                  : ""
              }`}</style>
              <div
                id="customizer-live-preview"
                className={`w-full max-w-[320px] h-[500px] rounded-2xl flex flex-col overflow-hidden transition-all style-${widgetStyle}`}
                style={{ ...primaryColorCssVars(primaryColor), zoom: fontSizePercent !== 100 ? `${fontSizePercent}%` : undefined } as React.CSSProperties}
              >
            {/* Header */}
            <div
              className="chat-header p-4 flex items-center gap-3 transition-all"
            >
              <div
                className="size-11 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-base overflow-hidden shrink-0 transition-colors"
                style={logoBgColor ? { backgroundColor: logoBgColor } : {}}
              >
                {dashHeaderLogo("size-6")}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight truncate">{botName}</h4>
                <p className="text-[9px] opacity-80">Online</p>
              </div>
              <div className="flex items-center shrink-0 opacity-80">
                <span className="p-1.5"><Bell className="size-3.5" /></span>
                <span className="p-1.5"><RefreshCw className="size-3.5" /></span>
                <span className="p-1.5"><X className="size-3.5" /></span>
              </div>
            </div>

            {previewView === "call" ? (
              <div className="flex-1 flex flex-col p-4 text-xs">
                <div className="flex items-center gap-3 w-full pb-3 border-b border-neutral-100 dark:border-neutral-850 shrink-0">
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center size-9"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${primaryColor}dd, ${primaryColor}88)`,
                      boxShadow: `0 0 12px ${primaryColor}55`,
                    }}
                  >
                    <div className="rounded-full bg-white/25 backdrop-blur-sm size-5" />
                  </div>
                  <p className="flex-1 min-w-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide truncate">00:14</p>
                </div>
                <div className="flex-1 min-h-0 w-full overflow-y-auto py-3 space-y-2.5">
                  <div className="flex justify-start">
                    <div className="bot-bubble max-w-[80%] px-3 py-2 text-xs leading-relaxed rounded-bl-md">
                      Hi! How can I help you today?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="user-bubble max-w-[80%] px-3 py-2 text-xs leading-relaxed rounded-br-md">
                      What are your pricing plans?
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 pb-1 pt-1 shrink-0">
                  <div className="size-12 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <MicOff className="size-5" />
                  </div>
                  <div className="size-14 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg">
                    <PhoneOff className="size-6" />
                  </div>
                </div>
              </div>
            ) : (
            <>
            {/* Messages list */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
              <div className="flex gap-2 max-w-[85%]">
                <div
                  className="agent-avatar-badge size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                  style={{
                    backgroundColor: colorScheme?.avatar?.bg || primaryColor || "#f97316",
                    color: colorScheme?.avatar?.text || getOnColor(colorScheme?.avatar?.bg || primaryColor || "#f97316"),
                  }}
                >
                  {dashAvatar("size-3.5")}
                </div>
                <div className="bot-bubble p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="mb-0.5">{children}</li>,
                      a: ({ href, children }) => <SafeMarkdownLink href={href} className="underline break-all">{children}</SafeMarkdownLink>,
                      pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                      code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                    }}
                  >
                    {welcomeMsg}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex gap-2 ml-auto flex-row-reverse max-w-[85%]">
                <div
                  className="user-bubble p-3 rounded-2xl rounded-tr-none leading-relaxed"
                >
                  Hi there, testing theme preview!
                </div>
              </div>

              {/* Static demo of the voice-message player */}
              <div className="flex gap-2 ml-auto flex-row-reverse max-w-[85%]">
                <div
                  className="user-bubble p-2.5 rounded-2xl rounded-tr-none leading-relaxed"
                >
                  <div className="audio-bubble flex items-center gap-2.5 py-0.5 min-w-[188px]">
                    <span className="audio-bubble-btn shrink-0 size-8 rounded-full flex items-center justify-center">
                      <Play className="size-3.5 fill-current ml-0.5" />
                    </span>
                    <span className="flex-1 flex items-center gap-[2.5px] h-5">
                      {[0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.45, 0.75, 0.55, 0.85, 0.4, 0.65, 0.5, 0.95, 0.6, 0.7, 0.45, 0.8, 0.55, 0.9, 0.5, 0.7, 0.4, 0.6].map((h, i) => (
                        <span key={i} className="audio-bubble-bar w-[2.5px] rounded-full shrink-0" style={{ height: `${h * 100}%`, opacity: i < 6 ? 1 : 0.35 }} />
                      ))}
                    </span>
                    <span className="audio-bubble-time text-[10px] tabular-nums opacity-70 shrink-0">0:12</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Suggested-message chips (live preview) */}
            {conversationStarters.filter(Boolean).length > 0 && (
              <div className="px-3 pb-1 flex flex-col items-end gap-1.5">
                {conversationStarters.filter(Boolean).slice(0, 4).map((s, i) => (
                  <span key={i} className="px-2.5 py-1.5 rounded-2xl border text-[11px] font-medium text-right" style={{ borderColor: primaryColor, color: primaryColor }}>{s}</span>
                ))}
              </div>
            )}

            {/* Footer input form */}
            <div className="p-3">
              <div className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5">
                <input
                  disabled
                  type="text"
                  placeholder="Compose your message…"
                  className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <span className="chat-input-bar-icon p-1.5 text-neutral-500"><Smile className="size-4.5" /></span>
                    <span className="chat-input-bar-icon p-1.5 text-neutral-500"><Paperclip className="size-4.5" /></span>
                    <span className="chat-input-bar-icon p-1.5 text-neutral-500"><Mic className="size-4.5" /></span>
                  </div>
                  {(() => {
                    const map: Record<string, { shape: string; icon: React.ReactNode; label?: string }> = {
                      plane: { shape: "size-7 rounded-full", icon: <Send className="size-3.5" /> },
                      arrowUp: { shape: "size-7 rounded-full", icon: <ArrowUp className="size-3.5" /> },
                      arrowRight: { shape: "size-7 rounded-full", icon: <ArrowRight className="size-3.5" /> },
                      square: { shape: "size-7 rounded-lg", icon: <Send className="size-3.5" /> },
                      label: { shape: "h-7 px-2.5 rounded-full gap-1", icon: <Send className="size-3" />, label: "Send" },
                    };
                    const c = map[sendButtonStyle] || map.plane;
                    return (
                      <button disabled style={{ backgroundColor: primaryColor, color: getOnColor(primaryColor) }} className={`send-btn ${c.shape} flex items-center justify-center shrink-0 opacity-90`}>
                        {c.icon}{c.label && <span className="text-[11px] font-semibold">{c.label}</span>}
                      </button>
                    );
                  })()}
                </div>
              </div>
              {!hideBranding && (
                <div className="text-center pt-2 text-[9px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wide">
                  Powered by <span className="font-bold text-neutral-500 dark:text-neutral-400">Chatty</span>
                </div>
              )}
            </div>

            {/* ── Bottom Navigation Dock Preview ── */}
            {(() => {
              const presetSig = getPresetSignature(widgetStyle);
              const effectiveNavStyle =
                colorScheme?.bottomNav?.style && colorScheme?.bottomNav?.style !== "default"
                  ? colorScheme.bottomNav.style
                  : presetSig.bottomNavStyle;
              const indicatorType =
                colorScheme?.bottomNav?.indicator || presetSig.bottomNavIndicator || "pill";
              const activeNavColor =
                colorScheme?.bottomNav?.activeColor || presetSig.bottomNavActive || primaryColor;
              const showLabels = colorScheme?.bottomNav?.showLabels !== false;

              const containerClasses =
                effectiveNavStyle === "pill" || effectiveNavStyle === "glass"
                  ? "p-2 bg-transparent flex justify-center shrink-0 relative"
                  : effectiveNavStyle === "chunky"
                    ? "p-2 bg-transparent shrink-0 relative"
                    : "shrink-0 relative";

              const navClasses =
                effectiveNavStyle === "pill"
                  ? "chat-bottom-nav w-full max-w-[290px] rounded-full border border-neutral-200/80 dark:border-neutral-800/80 shadow-md flex items-stretch overflow-hidden backdrop-blur-xl bg-card/90"
                  : effectiveNavStyle === "chunky"
                    ? "chat-bottom-nav w-full rounded-md border-3 border-black bg-white shadow-[3px_3px_0px_#000] flex items-stretch overflow-hidden font-mono"
                    : effectiveNavStyle === "glass"
                      ? "chat-bottom-nav w-full max-w-[290px] rounded-xl border border-white/30 bg-white/20 dark:bg-black/30 backdrop-blur-xl shadow-md flex items-stretch overflow-hidden"
                      : effectiveNavStyle === "luxury"
                        ? "chat-bottom-nav border-t border-[#b08a3e]/40 bg-[#161412] text-[#f7f5f0] flex items-stretch tracking-wider font-serif"
                        : effectiveNavStyle === "clean"
                          ? "chat-bottom-nav border-t border-neutral-200/80 dark:border-neutral-800/80 bg-background/95 backdrop-blur-sm flex items-stretch shadow-none"
                          : "chat-bottom-nav border-t border-neutral-100 dark:border-neutral-850 bg-card flex items-stretch";

              return (
                <div className={containerClasses}>
                  <div className={navClasses}>
                    {[
                      { id: "home", label: "Home", icon: <Home className="size-3.5" /> },
                      { id: "messages", label: "Chat", icon: <MessageSquare className="size-3.5" /> },
                      { id: "articles", label: "Articles", icon: <FileText className="size-3.5" /> },
                    ].map((t, idx) => {
                      const isActive = idx === 1;
                      return (
                        <div
                          key={t.id}
                          className={`chat-bottom-nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-semibold tracking-wide uppercase relative isolate cursor-default select-none ${isActive ? "active" : ""} ${
                            isActive ? "font-bold" : "opacity-60"
                          }`}
                          style={isActive ? { color: activeNavColor } : undefined}
                        >
                          <span className="relative z-10">{t.icon}</span>
                          {showLabels && <span className="relative z-10">{t.label}</span>}
                          {isActive && (
                            indicatorType === "pill" ? (
                              <span
                                className="absolute inset-1 rounded-full z-0 pointer-events-none"
                                style={{ backgroundColor: activeNavColor, opacity: 0.15 }}
                              />
                            ) : indicatorType === "dot" ? (
                              <span
                                className="absolute bottom-0.5 size-1.5 rounded-full z-20 shadow-xs pointer-events-none"
                                style={{ backgroundColor: activeNavColor }}
                              />
                            ) : (
                              <span
                                className="absolute top-0 left-2 right-2 h-[2px] rounded-full z-20 pointer-events-none"
                                style={{ backgroundColor: activeNavColor }}
                              />
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            </>
            )}
          </div>
          </>
          )}

          {/* Floating Launcher preview in Customizer */}
          <div className="mt-4 flex flex-col items-center gap-1.5 w-full">
            <span className="text-[10px] text-neutral-450 dark:text-neutral-500 uppercase font-bold tracking-wider">Button Preview</span>
            <div className="relative">
              {(() => {
                const schemeLauncherBg = colorScheme?.launcher?.bg;
                // Match the standalone widget: a saved section override wins,
                // otherwise the owner's Primary Hex Color is the launcher
                // accent. Falling back to the preset swatch is only for an
                // unset/legacy bot, so the dashboard can never preview a
                // different launcher from the live widget.
                const launcherBg = schemeLauncherBg || primaryColor || LAUNCHER_STYLES[widgetStyle]?.bg || "#f97316";
                const launcherSolidBg = launcherBg.indexOf("gradient") === -1 ? launcherBg : "#a855f7";
                const launcherIconColor = colorScheme?.launcher?.text || getOnColor(launcherSolidBg);
                return (
              <div
                style={{
                  background: launcherBg,
                  boxShadow: schemeLauncherBg ? undefined : LAUNCHER_STYLES[widgetStyle]?.shadow,
                  color: launcherIconColor,
                  borderRadius: launcherShape === "circle" ? "50%" :
                                launcherShape === "square" ? "0px" :
                                launcherShape === "rounded" ? "12px" :
                                "24px 24px 4px 24px" // bubble (right side)
                }}
                className="w-14 h-14 flex items-center justify-center transition-all duration-300 select-none cursor-pointer"
              >
                {(() => {
                  const ICONS: Record<string, LucideIcon> = { bot: BotIcon, headset: Headphones, sparkles: Sparkles, message: MessageSquare, user: User };
                  if (avatarIcon === "custom" && avatarUrl) {
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist
                    return <img src={avatarUrl} alt="" className="size-10 rounded-full object-cover" />;
                  }
                  if (avatarIcon && avatarIcon !== "logo" && ICONS[avatarIcon]) {
                    const IconComponent = ICONS[avatarIcon];
                    return <IconComponent className="size-6" />;
                  }
                  // Default brand logo
                  if (logoUrl) {
                    return (
                      <div
                        className="size-10 rounded-full flex items-center justify-center overflow-hidden"
                        style={logoBgColor ? { backgroundColor: logoBgColor } : { backgroundColor: "rgba(255,255,255,0.2)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist */}
                        <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded-full" />
                      </div>
                    );
                  }
                  return <div className="size-[17px] rounded-full opacity-90" style={{ background: colorScheme?.launcher?.text || getOnColor(launcherSolidBg) }} />;
                })()}
              </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
