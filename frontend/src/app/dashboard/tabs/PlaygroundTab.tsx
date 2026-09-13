"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion } from "framer-motion";
import { Sparkles, Check, Loader2, Send, ArrowUp, ArrowRight } from "lucide-react";
import { ModernSelect } from "@/components/ui/modern-select";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import { getOnColor, primaryColorCssVars, buildColorSchemeCss, type WidgetColorScheme } from "@/lib/color-contrast";
import type { KnowledgeMessage } from "../dashboard-types";

interface PlaygroundTabProps {
  playgroundView: "test" | "live";
  setPlaygroundView: (v: "test" | "live") => void;
  botId: string | null;
  primaryColor: string;
  widgetStyle: string;
  avatarIcon: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  logoBgColor: string;
  botName: string;
  showSenderTag: boolean;
  csatEnabled: boolean;
  colorScheme: WidgetColorScheme | null;
  fontFamily: string | null;
  fontSizePercent: number;
  welcomeMsg: string;
  language: "EN" | "ES" | "FR" | "DE" | "IT";
  setLanguage: (l: "EN" | "ES" | "FR" | "DE" | "IT") => void;
  languageOptions: { value: string; label: string }[];
  playgroundMessages: KnowledgeMessage[];
  setPlaygroundMessages: React.Dispatch<React.SetStateAction<KnowledgeMessage[]>>;
  dashHeaderLogo: (className: string) => React.ReactNode;
  dashAvatar: (className: string) => React.ReactNode;
  handleSetupQuickReply: (v: string) => void | Promise<void>;
  googleConnected: boolean;
  microsoftConnected: boolean;
  botCountry: string;
  setBotCountry: (c: string) => void;
  countryOptions: { value: string; label: string }[];
  botTimezone: string;
  setBotTimezone: (tz: string) => void;
  timezoneOptions: { value: string; label: string }[];
  t: (k: string) => string;
  handleInputChange: (setter: (v: string) => void, val: string) => void;
  meetingProvider: string;
  providerOptions: { value: string; label: string }[];
  handleMeetingProviderChange: (p: string) => void;
  pendingLeadFields: string[];
  setPendingLeadFields: React.Dispatch<React.SetStateAction<string[]>>;
  isBotResponding: boolean;
  liveThinkingSteps: string[];
  playgroundEndRef: React.RefObject<HTMLDivElement | null>;
  collectedInPlayground: boolean;
  setCollectedInPlayground: (b: boolean) => void;
  playgroundInput: string;
  setPlaygroundInput: (i: string) => void;
  handlePlaygroundSend: (e: React.FormEvent) => void | Promise<void>;
  sendButtonStyle: string;
}

export function PlaygroundTab({
  playgroundView,
  setPlaygroundView,
  botId,
  primaryColor,
  widgetStyle,
  avatarIcon,
  avatarUrl,
  logoUrl,
  logoBgColor,
  botName,
  showSenderTag,
  csatEnabled,
  colorScheme,
  fontFamily,
  fontSizePercent,
  welcomeMsg,
  language,
  setLanguage,
  languageOptions,
  playgroundMessages,
  setPlaygroundMessages,
  dashHeaderLogo,
  dashAvatar,
  handleSetupQuickReply,
  googleConnected,
  microsoftConnected,
  botCountry,
  setBotCountry,
  countryOptions,
  botTimezone,
  setBotTimezone,
  timezoneOptions,
  t,
  handleInputChange,
  meetingProvider,
  providerOptions,
  handleMeetingProviderChange,
  pendingLeadFields,
  setPendingLeadFields,
  isBotResponding,
  liveThinkingSteps,
  playgroundEndRef,
  collectedInPlayground,
  setCollectedInPlayground,
  playgroundInput,
  setPlaygroundInput,
  handlePlaygroundSend,
  sendButtonStyle,
}: PlaygroundTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 flex flex-col items-center gap-3">
      <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-0.5 text-[11px] font-semibold">
        <button
          onClick={() => setPlaygroundView("test")}
          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
            playgroundView === "test"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500"
          }`}
        >
          AI Test
        </button>
        <button
          onClick={() => setPlaygroundView("live")}
          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
            playgroundView === "live"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-500"
          }`}
        >
          Live Widget
        </button>
      </div>
      {playgroundView === "live" && (
        botId ? (
          <>
            <iframe
              key={`${botId}-${primaryColor}-${widgetStyle}-${avatarIcon}-${logoUrl}-${logoBgColor}-${botName}-${showSenderTag}-${csatEnabled}-${JSON.stringify(colorScheme)}-${fontFamily}-${fontSizePercent}`}
              src={`/embed/${botId}?preview=true&color=${encodeURIComponent(primaryColor)}&style=${widgetStyle}&name=${encodeURIComponent(botName)}&welcome=${encodeURIComponent(welcomeMsg)}&avatar_icon=${avatarIcon}&avatar_url=${encodeURIComponent(avatarUrl || "")}&logo_url=${encodeURIComponent(logoUrl || "")}&logo_bg_color=${encodeURIComponent(logoBgColor || "")}&show_sender_tag=${showSenderTag}&csat_enabled=${csatEnabled}&color_scheme=${encodeURIComponent(colorScheme ? JSON.stringify(colorScheme) : "")}&font=${encodeURIComponent(fontFamily || "")}&font_size_percent=${fontSizePercent}`}
              title="Live widget preview"
              className="w-full max-w-lg h-[500px] border-0"
            />
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Live preview - reflects your <span className="font-semibold">current</span> customizer settings in real time.</p>
          </>
        ) : (
          <div className="w-full max-w-lg h-[500px] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-xs text-neutral-400">Save your bot to preview the live widget.</div>
        )
      )}
      <style>{buildColorSchemeCss(colorScheme, "#playground-mock-preview")}</style>
      <div
        id="playground-mock-preview"
        className={`w-full max-w-lg h-[500px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative flex flex-col style-${widgetStyle} ${playgroundView === "live" ? "hidden" : ""}`}
        style={primaryColorCssVars(primaryColor) as React.CSSProperties}
      >
        {/* Playground Header */}
        <div
          style={{ backgroundColor: primaryColor }}
          className="chat-header p-4 flex items-center justify-between border-b border-transparent"
        >
          <div className="flex items-center gap-3">
            <div 
              className="size-11 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-base overflow-hidden shrink-0 transition-colors"
              style={logoBgColor ? { backgroundColor: logoBgColor } : {}}
            >
              {dashHeaderLogo("size-6")}
            </div>
            <div>
              <h4 className="font-semibold text-sm leading-tight">{botName}</h4>
              <p className="text-[9px] opacity-80 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-green-400 animate-pulse"></span>
                Online · replies instantly
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Language picker at the top of the assistant */}
            <div className="w-28">
              <ModernSelect
                value={language}
                options={languageOptions}
                onChange={(v) => setLanguage(v as "EN" | "ES" | "FR" | "DE" | "IT")}
                align="right"
                size="sm"
              />
            </div>
            <button
              onClick={() => setPlaygroundMessages([{ role: "assistant", content: welcomeMsg }])}
              className="px-2 py-1 rounded border border-white/20 hover:bg-white/10 text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
          {playgroundMessages.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`flex gap-2 max-w-[85%] ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {msg.role !== "user" && (
                <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">{dashAvatar("size-3.5")}</div>
              )}
              <div className="flex flex-col gap-1 w-full">
                {/* Collapsible HTML5 Details for Reasoning Trace */}
                {msg.role !== "user" && msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                  <details className="mb-1 text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2 cursor-pointer select-none">
                    <summary className="font-semibold flex items-center gap-1.5 focus:outline-none hover:text-neutral-700 dark:hover:text-neutral-350">
                      <Sparkles className="size-3 text-[#f97316]" />
                      Agent Reasoning Trace
                    </summary>
                    <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                      {msg.thinkingSteps.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div
                  className={`p-3 rounded-2xl leading-relaxed ${
                    msg.role === "user"
                      ? "user-bubble rounded-tr-none"
                      : "bot-bubble bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 rounded-tl-none"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: primaryColor, color: getOnColor(primaryColor) } : {}}
                >
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
                      code: ({ children }) => (
                        <code className={msg.role === "user" ? "bg-white/20 text-white px-1 py-0.5 rounded text-[10px] font-mono" : "bg-neutral-200 dark:bg-neutral-850 px-1 py-0.5 rounded text-[10px] font-mono"}>
                          {children}
                        </code>
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Agentic setup interactive controls */}
                {msg.role !== "user" && (msg.calendarButtons || msg.connectorButtons) && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <button
                      onClick={() => handleSetupQuickReply("calendar_google")}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                        googleConnected
                          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                      }`}
                    >
                      <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
                      {googleConnected ? "Google Connected" : "Connect Google Calendar"}
                      {googleConnected && <Check className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => handleSetupQuickReply("calendar_microsoft")}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                        microsoftConnected
                          ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-400"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                      }`}
                    >
                      <svg className="size-4" viewBox="0 0 24 24"><path fill="#F25022" d="M3 3h8v8H3z"/><path fill="#7FBA00" d="M13 3h8v8h-8z"/><path fill="#00A4EF" d="M3 13h8v8H3z"/><path fill="#FFB900" d="M13 13h8v8h-8z"/></svg>
                      {microsoftConnected ? "Microsoft Connected" : "Connect Outlook Calendar"}
                      {microsoftConnected && <Check className="size-3.5" />}
                    </button>
                  </div>
                )}

                {/* Timezone + Country pickers inline in chat */}
                {msg.role !== "user" && msg.tzPicker && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-w-md">
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">{t("country")}</label>
                      <ModernSelect value={botCountry} options={countryOptions} onChange={(v) => handleInputChange(setBotCountry, v)} searchable size="sm" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">{t("timezone")}</label>
                      <ModernSelect value={botTimezone} options={timezoneOptions} onChange={(v) => handleInputChange(setBotTimezone, v)} searchable size="sm" />
                    </div>
                  </div>
                )}

                {/* Meeting provider picker inline in chat */}
                {msg.role !== "user" && msg.providerPicker && (
                  <div className="mt-1 max-w-[220px]">
                    <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">Meeting Provider</label>
                    <ModernSelect value={meetingProvider} options={providerOptions} onChange={handleMeetingProviderChange} size="sm" />
                  </div>
                )}

                {/* Lead field picker */}
                {msg.role !== "user" && msg.leadFieldPicker && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {["name", "email", "phone", "company", "job_title", "country", "budget", "industry"].map((f) => {
                      const required = f === "name" || f === "email";
                      const on = pendingLeadFields.includes(f);
                      return (
                        <button
                          key={f}
                          disabled={required}
                          onClick={() =>
                            setPendingLeadFields((prev) =>
                              prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors capitalize ${
                            on
                              ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                              : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          } ${required ? "opacity-70 cursor-default" : "cursor-pointer"}`}
                        >
                          {f.replace("_", " ")}{required ? " *" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Quick reply buttons */}
                {msg.role !== "user" && msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.quickReplies.map((qr, qi) => (
                      <button
                        key={qi}
                        onClick={() => handleSetupQuickReply(qr.value)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-[#f97316]/40 hover:bg-[#f97316]/5 text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        {qr.icon && <span>{qr.icon}</span>}
                        {qr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isBotResponding && (
            <div className="flex gap-2 mr-auto max-w-[85%] w-full">
              <div className="size-6 rounded-full bg-neutral-150 dark:bg-neutral-800 flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">{dashAvatar("size-3.5")}</div>
              <div className="flex-grow flex flex-col gap-1">
                {/* Live Thinking Status & Trace */}
                <div className="text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg p-2">
                  <div className="font-semibold flex items-center gap-1.5 animate-pulse text-[#f97316]">
                    <Loader2 className="size-3 animate-spin" />
                    Agent is reasoning...
                  </div>
                  {liveThinkingSteps.length > 0 && (
                    <ul className="mt-1.5 pl-3 list-disc space-y-1 font-mono leading-normal border-t border-neutral-150/40 dark:border-neutral-800/40 pt-1.5">
                      {liveThinkingSteps.map((step, sIdx) => (
                        <li key={sIdx} className="animate-fade-in">{step}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-400 dark:bg-neutral-850 flex items-center gap-1.5 w-fit">
                  <span className="size-1.5 rounded-full bg-neutral-450 animate-bounce"></span>
                  <span className="size-1.5 rounded-full bg-neutral-455 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="size-1.5 rounded-full bg-neutral-460 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={playgroundEndRef} />
        </div>

        {/* Alert banner if lead captured */}
        {collectedInPlayground && (
          <div className="p-2 bg-green-50 dark:bg-green-950/20 border-t border-green-200 dark:border-green-900/50 flex items-center justify-between text-[10px] text-green-700 dark:text-green-400 px-4">
            <span>New lead collected! Added to the Leads tab.</span>
            <button onClick={() => setCollectedInPlayground(false)} className="font-bold underline cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handlePlaygroundSend} className="p-3 border-t border-neutral-150 dark:border-neutral-900 flex gap-2">
          <input
            type="text"
            placeholder="Ask a question or type 'lead'..."
            value={playgroundInput}
            onChange={(e) => setPlaygroundInput(e.target.value)}
            className="chat-input-bar flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none"
          />
          {(() => {
            const map: Record<string, { shape: string; icon: React.ReactNode; label?: string }> = {
              plane: { shape: "size-9 rounded-full", icon: <Send className="size-4" /> },
              arrowUp: { shape: "size-9 rounded-full", icon: <ArrowUp className="size-4" /> },
              arrowRight: { shape: "size-9 rounded-full", icon: <ArrowRight className="size-4" /> },
              square: { shape: "size-9 rounded-lg", icon: <Send className="size-4" /> },
              label: { shape: "h-9 px-3.5 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
            };
            const c = map[sendButtonStyle] || map.plane;
            return (
              <button
                type="submit"
                style={{ backgroundColor: primaryColor, color: getOnColor(primaryColor) }}
                className={`${c.shape} flex items-center justify-center shrink-0 hover:opacity-90 cursor-pointer`}
              >
                {c.icon}{c.label && <span className="text-xs font-semibold">{c.label}</span>}
              </button>
            );
          })()}
        </form>
      </div>
    </div>
  );
}
