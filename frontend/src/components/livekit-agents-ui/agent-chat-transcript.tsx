"use client";

import React, { useEffect, useRef } from "react";
import type { AgentState, ReceivedMessage } from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import { AgentChatIndicator } from "./agent-chat-indicator";
import { cn } from "@/lib/utils";

export interface TranscriptItem {
  id: string;
  speaker: "visitor" | "agent";
  text: string;
  final?: boolean;
  timestamp?: number;
}

export interface AgentChatTranscriptProps {
  agentState?: AgentState;
  messages: TranscriptItem[];
  className?: string;
  primaryColor?: string;
  renderRichCard?: (entry: TranscriptItem) => React.ReactNode;
  autoScroll?: boolean;
}

const transcriptMdComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <SafeMarkdownLink href={href} {...rest}>
      {children}
    </SafeMarkdownLink>
  ),
  p: ({ children }) => <span className="block my-0.5">{children}</span>,
  ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1">{children}</ol>,
  li: ({ children }) => <li className="text-inherit">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
  em: ({ children }) => <em className="italic text-inherit">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono text-[11px]">
      {children}
    </code>
  ),
};

/** Calm live-transcription cue; an audio pulse reads as active listening rather than a stuck caret. */
function TranscriptActivityIndicator({ label = "Transcribing…" }: { label?: string }) {
  return (
    <span className="ml-2 inline-flex h-3 items-center gap-[2px] align-middle" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.span
          key={index}
          className="h-1.5 w-[2px] origin-center rounded-full bg-current opacity-60"
          animate={{ scaleY: [0.55, 1.9, 0.7, 1.45, 0.55], opacity: [0.35, 0.9, 0.5, 0.8, 0.35] }}
          transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut", delay: index * 0.1 }}
        />
      ))}
    </span>
  );
}

/**
 * Official LiveKit Agents Chat Transcript:
 * Displays streaming or completed turns between visitor and agent with smooth motion,
 * thinking shimmer indicator, rich content embeds, and automatic scrolling.
 */
export function AgentChatTranscript({
  agentState,
  messages = [],
  className,
  primaryColor = "#f97316",
  renderRichCard,
  autoScroll = true,
}: AgentChatTranscriptProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, agentState, autoScroll]);

  return (
    <div
      data-slot="agent-chat-transcript"
      className={cn(
        "flex h-full w-full flex-col overflow-y-auto overscroll-contain px-3 py-4 chatty-voice-scrollbar space-y-3",
        className
      )}
    >
      {messages.length === 0 && agentState !== "thinking" ? (
        <div className="flex h-full min-h-[140px] items-center justify-center text-center">
          <p className="text-xs text-neutral-400 dark:text-neutral-500 px-6">
            Agent is listening · speak into your mic or send a message below
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((item) => {
            const isUser = item.speaker === "visitor";
            const isFinal = item.final !== false;
            const richCardNode = renderRichCard ? renderRichCard(item) : null;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                className={cn(
                  "flex w-full flex-col",
                  isUser ? "items-end" : "items-start",
                  richCardNode ? "w-full" : "max-w-[90%]"
                )}
              >
                {/* Speaker Header */}
                <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-medium tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isUser ? "bg-sky-500" : "bg-emerald-500"
                    )}
                  />
                  <span>{isUser ? "You" : "Chatty Agent"}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm transition-all",
                    isUser
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 rounded-br-xs"
                      : "bg-white text-neutral-900 border border-neutral-200/80 dark:bg-neutral-900/90 dark:border-neutral-800 dark:text-neutral-100 rounded-bl-xs",
                    richCardNode && "w-full"
                  )}
                >
                  {item.text ? (
                    <div>
                      {!isUser && isFinal ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={transcriptMdComponents}
                        >
                          {item.text}
                        </ReactMarkdown>
                      ) : (
                        <span className="whitespace-pre-wrap">{item.text}</span>
                      )}
                      {!isFinal && <TranscriptActivityIndicator />}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <span>Transcribing</span>
                      <TranscriptActivityIndicator />
                    </span>
                  )}

                  {/* Embedded Rich Card (booking, product, video) */}
                  {richCardNode && <div className="mt-2.5 w-full">{richCardNode}</div>}
                </div>
              </motion.div>
            );
          })}

          {/* Official LiveKit Thinking Indicator */}
          {agentState === "thinking" && (
            <motion.div
              key="thinking-indicator"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 py-1 text-xs text-neutral-500 dark:text-neutral-400"
              role="status"
            >
              <AgentChatIndicator size="sm" />
              <span className="text-[11px] font-medium tracking-wide animate-pulse">
                Thinking…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      <div ref={scrollEndRef} className="h-0.5 shrink-0" />
    </div>
  );
}
