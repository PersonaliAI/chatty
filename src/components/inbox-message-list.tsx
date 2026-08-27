"use client";

import { memo, type RefObject } from "react";
import { Bot, Headphones, Paperclip, ThumbsDown, ThumbsUp, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";

export interface Msg {
  id?: string;
  role: string;
  content: string;
  sender?: string;
  created_at?: string;
  feedback_rating?: string | null;
  correction?: string | null;
}

/* ── Attachment URL trust check ───────────────────────────────────
 * Message content is free text a visitor fully controls, so only render a
 * URL as an img/audio src or link if it genuinely points at our own upload
 * bucket (or a same-session blob: URL from the composer preview, which a
 * remote visitor can't forge) — not any arbitrary http(s) URL a visitor
 * could type to get rendered as a trusted-looking attachment. */
function isTrustedAttachmentUrl(url: string): boolean {
  if (url.startsWith("blob:")) return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  try {
    const parsed = new URL(url);
    const base = new URL(supabaseUrl);
    return (
      parsed.origin === base.origin &&
      parsed.pathname.startsWith("/storage/v1/object/public/chatty-uploads/")
    );
  } catch {
    return false;
  }
}

interface MessageListProps {
  messages: Msg[];
  color: string;
  visitorName: string;
  correctingId: string | null;
  correctionDraft: string;
  setCorrectingId: (id: string | null) => void;
  setCorrectionDraft: (draft: string) => void;
  setFeedback: (messageId: string, rating: "up" | "down" | null, correction?: string) => void;
  endRef: RefObject<HTMLDivElement | null>;
}

/**
 * Split out of InboxPanel and memoized so that unrelated input-bar state
 * (emoji picker, attach menu, canned-response popover, etc.) toggling
 * doesn't force every message in a long conversation to re-render —
 * each one runs a full ReactMarkdown/KaTeX parse, which was making the
 * emoji picker (and anything else next to the composer) feel stuck/slow
 * to open on conversations with many messages.
 */
function MessageListInner({
  messages,
  color,
  visitorName,
  correctingId,
  correctionDraft,
  setCorrectingId,
  setCorrectionDraft,
  setFeedback,
  endRef,
}: MessageListProps) {
  return (
    <>
      {messages.map((m, i) => {
        const isVisitor = m.role === "user";
        const isHuman = m.sender === "human";

        let cleanContent = m.content;
        let attachmentUrl: string | null = null;
        let attachmentName = "";

        const lines = m.content.split("\n");
        if (lines.length >= 2) {
          const lastLine = lines[lines.length - 1].trim();
          const prevLine = lines[lines.length - 2].trim();
          if (isTrustedAttachmentUrl(lastLine)) {
            if (prevLine.includes("[attachment:")) {
              attachmentUrl = lastLine;
              const match = prevLine.match(/\[attachment:\s*(.*?)\]/);
              attachmentName = match ? match[1] : "attachment";
              cleanContent = lines.slice(0, lines.length - 2).join("\n").trim();
            }
          }
        }

        const isImage = attachmentUrl && (
          attachmentName.toLowerCase().endsWith(".png") ||
          attachmentName.toLowerCase().endsWith(".jpg") ||
          attachmentName.toLowerCase().endsWith(".jpeg") ||
          attachmentName.toLowerCase().endsWith(".gif") ||
          attachmentName.toLowerCase().endsWith(".webp") ||
          attachmentUrl.includes("image/")
        );

        const isAudio = attachmentUrl && (
          attachmentName.toLowerCase().endsWith(".wav") ||
          attachmentName.toLowerCase().endsWith(".mp3") ||
          attachmentName.toLowerCase().endsWith(".webm") ||
          attachmentName.toLowerCase().endsWith(".ogg") ||
          attachmentUrl.includes("audio/")
        );

        const senderName = isVisitor
          ? visitorName
          : isHuman ? "You" : "Assistant";

        return (
          <div key={i} className={`flex gap-2 max-w-[85%] ${isVisitor ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
            <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${isVisitor ? "bg-neutral-200 dark:bg-neutral-700" : isHuman ? "bg-purple-500 text-white" : "text-white"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
              {isVisitor ? <User className="size-3" /> : isHuman ? <Headphones className="size-3" /> : <Bot className="size-3" />}
            </div>
            <div className={`flex flex-col min-w-0 ${isVisitor ? "items-start" : "items-end"}`}>
            <span className={`text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 px-0.5 mb-0.5 ${isVisitor ? "text-left" : "text-right"}`}>{senderName}</span>
            <div className={`p-2.5 rounded-2xl ${isVisitor ? "bg-neutral-100 dark:bg-neutral-800 rounded-tl-none" : isHuman ? "bg-purple-500 text-white rounded-tr-none" : "text-white rounded-tr-none"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
              {attachmentUrl && isImage && (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded-file/blob URL, not in next/image's domain allowlist
                <img src={attachmentUrl} alt="attachment" className="rounded-lg mb-1.5 max-h-40 object-cover" />
              )}
              {attachmentUrl && isAudio && (
                <audio controls src={attachmentUrl} className="mb-1.5 max-w-[180px]" />
              )}
              {attachmentUrl && !isImage && !isAudio && (
                <a href={attachmentUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-1 text-[10px] underline mb-1.5 ${isVisitor ? "text-neutral-600 dark:text-neutral-300" : "text-white"}`}>
                  <Paperclip className="size-3 animate-[pulse_2s_infinite]" />
                  {attachmentName}
                </a>
              )}
              {cleanContent && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    a: ({ href, children }) => <SafeMarkdownLink href={href} className="underline break-all">{children}</SafeMarkdownLink>,
                    pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                    code: ({ children }) => (
                      <code className={isVisitor || isHuman ? "bg-black/10 dark:bg-white/20 px-1 py-0.5 rounded text-[10px] font-mono" : "bg-white/20 text-white px-1 py-0.5 rounded text-[10px] font-mono"}>
                        {children}
                      </code>
                    )
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>
              )}
            </div>
            </div>
            {!isVisitor && !isHuman && m.id && (
              <div className="flex flex-col gap-1 self-end pb-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFeedback(m.id!, m.feedback_rating === "up" ? null : "up")}
                    className={`p-1 rounded cursor-pointer ${m.feedback_rating === "up" ? "text-green-600" : "text-neutral-300 hover:text-neutral-500"}`}
                    title="Good answer"
                  >
                    <ThumbsUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = m.feedback_rating === "down" ? null : "down";
                      setFeedback(m.id!, next);
                      if (next === "down") { setCorrectingId(m.id!); setCorrectionDraft(m.correction || ""); }
                    }}
                    className={`p-1 rounded cursor-pointer ${m.feedback_rating === "down" ? "text-red-500" : "text-neutral-300 hover:text-neutral-500"}`}
                    title="Needs correction"
                  >
                    <ThumbsDown className="size-3" />
                  </button>
                </div>
                {correctingId === m.id && (
                  <div className="w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 shadow-lg">
                    <textarea
                      rows={3}
                      value={correctionDraft}
                      onChange={(e) => setCorrectionDraft(e.target.value)}
                      placeholder="What should it have said?"
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 text-[10px] resize-none focus:outline-none"
                    />
                    <div className="flex justify-end gap-1.5 mt-1.5">
                      <button onClick={() => { setCorrectingId(null); setCorrectionDraft(""); }} className="text-[10px] text-neutral-400 hover:text-neutral-600 cursor-pointer px-2 py-1">Cancel</button>
                      <button
                        onClick={() => setFeedback(m.id!, "down", correctionDraft.trim())}
                        disabled={!correctionDraft.trim()}
                        className="text-[10px] font-semibold text-white rounded-md px-2 py-1 cursor-pointer disabled:opacity-40"
                        style={{ background: color }}
                      >
                        Save correction
                      </button>
                    </div>
                  </div>
                )}
                {m.correction && correctingId !== m.id && (
                  <button onClick={() => { setCorrectingId(m.id!); setCorrectionDraft(m.correction || ""); }} className="text-[9px] text-neutral-400 hover:underline cursor-pointer text-right">
                    Edit correction
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </>
  );
}

export const MessageList = memo(MessageListInner);
