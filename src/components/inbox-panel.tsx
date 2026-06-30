"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Send, RefreshCw, Inbox as InboxIcon, Bot, User, Headphones, Trash2, Paperclip, Smile, Mic, Square, X, Check, AlertCircle } from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from "emoji-picker-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AC();
  const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const len = audioBuf.length;
  // A near-instant tap-to-stop can decode to an AudioBuffer with ~0 samples —
  // that still produces a "valid" (44-byte-header) WAV with no audio content,
  // which Gemini silently treats as empty. Require a minimum of ~150ms.
  if (len < audioBuf.sampleRate * 0.15) {
    throw new Error("Recording too short");
  }
  const rate = audioBuf.sampleRate;
  const numCh = audioBuf.numberOfChannels;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const d = audioBuf.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / numCh;
  }
  const view = new DataView(new ArrayBuffer(44 + len * 2));
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); ws(8, "WAVE"); ws(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ws(36, "data"); view.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) { const s = Math.max(-1, Math.min(1, mono[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return new Blob([view], { type: "audio/wav" });
}

interface Session {
  id: string;
  session_id: string;
  visitor_name?: string;
  last_message?: string;
  last_message_at?: string;
  ai_paused?: boolean;
  needs_attention?: boolean;
}
interface Msg { role: string; content: string; sender?: string; created_at?: string; }

interface Props {
  botId: string;
  fetchBackend: (path: string, opts?: RequestInit) => Promise<Response>;
  formatDateTime: (s: string) => string;
  color?: string;
}

export function InboxPanel({ botId, fetchBackend, formatDateTime, color = "#f97316" }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom states for toast and confirm modal
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const current = sessions.find((s) => s.session_id === selected);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox?bot_id=${botId}`);
      if (res.ok) { const d = await res.json(); setSessions(d.sessions || []); }
    } catch {} finally { setLoadingSessions(false); }
  }, [botId, fetchBackend]);

  const loadMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetchBackend(`/api/admin/inbox/messages?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`);
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch {}
  }, [botId, fetchBackend]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { if (selected) loadMessages(selected); }, [selected, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Live polling
  useEffect(() => {
    const id = setInterval(() => { loadSessions(); if (selected) loadMessages(selected); }, 5000);
    return () => clearInterval(id);
  }, [selected, loadSessions, loadMessages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const text = reply;
    setReply("");
    setMessages((p) => [...p, { role: "assistant", content: text, sender: "human" }]);
    try {
      await fetchBackend("/api/admin/inbox/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, text }),
      });
      loadSessions();
    } catch {} finally { setSending(false); }
  };

  const sendMedia = async (file: File | Blob, filename: string, caption = "") => {
    if (!selected) return;
    setSending(true);
    const localUrl = URL.createObjectURL(file);
    const display = (caption.trim() + (caption.trim() ? "\n" : "")) + `[attachment: ${filename}]`;
    const tempContent = display + `\n${localUrl}`;
    setMessages((p) => [...p, { role: "assistant", content: tempContent, sender: "human" }]);
    setReply("");
    setEmojiOpen(false);
    try {
      const fd = new FormData();
      fd.append("bot_id", botId);
      fd.append("session_id", selected);
      fd.append("text", caption);
      fd.append("file", file, filename);
      await fetchBackend("/api/admin/inbox/reply/media", {
        method: "POST",
        body: fd,
      });
      loadSessions();
      if (selected) loadMessages(selected);
    } catch {
      showToast("Failed to upload attachment", "error");
    } finally {
      setSending(false);
    }
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) sendMedia(f, f.name);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecording(false);
        if (blob.size === 0) return;
        try {
          const wav = await audioBlobToWav(blob);
          sendMedia(wav, "voice-message.wav");
        } catch {
          // Don't fall back to sending the raw recording — Gemini doesn't
          // accept audio/webm (the browser's native recording format), so a
          // silent fallback used to upload audio the AI could never read,
          // appearing as a sent-but-ignored "empty" message.
          showToast("Couldn't process that recording — try again.", "error");
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      showToast("Microphone access denied.", "error");
    }
  };

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Delete Conversation",
      message: "Are you sure you want to delete this conversation? This can't be undone.",
      onConfirm: async () => {
        setSessions((p) => p.filter((s) => s.session_id !== sid));
        if (selected === sid) { setSelected(null); setMessages([]); }
        try {
          await fetchBackend("/api/admin/inbox/delete", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bot_id: botId, session_id: sid }),
          });
          showToast("Conversation deleted successfully.", "success");
        } catch {}
      }
    });
  };

  const toggleAI = async (paused: boolean) => {
    if (!selected) return;
    setSessions((p) => p.map((s) => s.session_id === selected ? { ...s, ai_paused: paused } : s));
    try {
      await fetchBackend("/api/admin/inbox/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, ai_paused: paused }),
      });
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Sessions list */}
      <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Conversations ({sessions.length})</span>
          <button onClick={loadSessions} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><RefreshCw className={`size-3.5 ${loadingSessions ? "animate-spin" : ""}`} /></button>
        </div>
        <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850">
          {sessions.length === 0 ? (
            <div className="p-8 text-center"><InboxIcon className="size-7 text-neutral-300 mx-auto" /><p className="text-xs text-neutral-400 mt-2">No conversations yet</p></div>
          ) : sessions.map((s) => (
            <div key={s.id} role="button" tabIndex={0} onClick={() => setSelected(s.session_id)}
              className={`group w-full text-left p-3 transition-colors cursor-pointer ${selected === s.session_id ? "bg-[#f97316]/5 border-l-2 border-l-[#f97316]" : s.needs_attention ? "bg-red-50/60 dark:bg-red-950/15 border-l-2 border-l-red-500" : "hover:bg-neutral-50 dark:hover:bg-neutral-850/40 border-l-2 border-l-transparent"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                  {s.needs_attention && <span className="size-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                  {s.visitor_name || `Visitor ${s.session_id.slice(-5)}`}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.needs_attention
                    ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-1"><Headphones className="size-2.5" />Needs you</span>
                    : s.ai_paused
                    ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 flex items-center gap-1"><Headphones className="size-2.5" />Live</span>
                    : <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-1"><Bot className="size-2.5" />AI</span>}
                  <button onClick={(e) => deleteSession(s.session_id, e)} aria-label="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity p-0.5 cursor-pointer">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 truncate mt-0.5">{s.last_message || "…"}</p>
              {s.last_message_at && <p className="text-[9px] text-neutral-300 dark:text-neutral-600 mt-0.5">{formatDateTime(s.last_message_at)}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Transcript + reply */}
      <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">Select a conversation</div>
        ) : (
          <>
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
              <span className="text-xs font-semibold">{current?.visitor_name || `Visitor ${selected.slice(-5)}`}</span>
              <button onClick={() => toggleAI(!current?.ai_paused)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1.5 ${current?.ai_paused ? "bg-[#f97316] text-white" : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"}`}>
                {current?.ai_paused ? <><Headphones className="size-3" />You're handling — resume AI</> : <><Bot className="size-3" />AI is handling — take over</>}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {messages.map((m, i) => {
                const isVisitor = m.role === "user";
                const isHuman = m.sender === "human";

                // Parse attachment if exists in m.content
                let cleanContent = m.content;
                let attachmentUrl: string | null = null;
                let attachmentName = "";

                const lines = m.content.split("\n");
                if (lines.length >= 2) {
                  const lastLine = lines[lines.length - 1].trim();
                  const prevLine = lines[lines.length - 2].trim();
                  if (lastLine.startsWith("http://") || lastLine.startsWith("https://") || lastLine.startsWith("blob:")) {
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

                return (
                  <div key={i} className={`flex gap-2 max-w-[85%] ${isVisitor ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                    <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${isVisitor ? "bg-neutral-200 dark:bg-neutral-700" : isHuman ? "bg-purple-500 text-white" : "text-white"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
                      {isVisitor ? <User className="size-3" /> : isHuman ? <Headphones className="size-3" /> : <Bot className="size-3" />}
                    </div>
                    <div className={`p-2.5 rounded-2xl ${isVisitor ? "bg-neutral-100 dark:bg-neutral-800 rounded-tl-none" : isHuman ? "bg-purple-500 text-white rounded-tr-none" : "text-white rounded-tr-none"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
                      {attachmentUrl && isImage && (
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
                );
              })}
              <div ref={endRef} />
            </div>
            <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative">
              <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" />
              {emojiOpen && (
                <div className="absolute bottom-[84px] left-2.5 right-2.5 z-10 overflow-hidden rounded-xl shadow-lg">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => setReply((v) => v + emojiData.emoji)}
                    theme={EmojiTheme.AUTO}
                    emojiStyle={EmojiStyle.NATIVE}
                    skinTonesDisabled
                    lazyLoadEmojis
                    width="100%"
                    height={320}
                  />
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5 focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onFocus={() => setEmojiOpen(false)}
                  placeholder={recording ? "Recording… tap ◼ to send" : "Type a reply (this takes over from AI)…"} disabled={sending || recording}
                  className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4.5" /></button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full group" aria-label="Attach file">
                      <Paperclip className="size-4.5 group-hover:animate-bounce transition-transform" />
                    </button>
                    <button type="button" onClick={toggleRecord} className={`p-1.5 rounded-full ${recording ? "text-red-500 animate-pulse" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`} aria-label="Record audio">
                      {recording ? <Square className="size-4.5 fill-current" /> : <Mic className="size-4.5" />}
                    </button>
                  </div>
                  <button type="submit" disabled={sending || !reply.trim()} style={{ background: color }}
                    className="size-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 shrink-0 hover:opacity-90 transition-opacity">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl px-4 py-3 shadow-2xl text-xs font-semibold text-neutral-855 dark:text-white animate-in slide-in-from-bottom-5 fade-in duration-300">
          {toast.type === "success" ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400">
              <Check className="size-3.5" />
            </span>
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400">
              <AlertCircle className="size-3.5" />
            </span>
          )}
          <span className="max-w-[250px] truncate">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
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
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal(null);
                  onConfirm();
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
