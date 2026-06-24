"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Send, RefreshCw, Inbox as InboxIcon, Bot, User, Headphones, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

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

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    setSessions((p) => p.filter((s) => s.session_id !== sid));
    if (selected === sid) { setSelected(null); setMessages([]); }
    try {
      await fetchBackend("/api/admin/inbox/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sid }),
      });
    } catch {}
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
                return (
                  <div key={i} className={`flex gap-2 max-w-[85%] ${isVisitor ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                    <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${isVisitor ? "bg-neutral-200 dark:bg-neutral-700" : isHuman ? "bg-purple-500 text-white" : "text-white"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
                      {isVisitor ? <User className="size-3" /> : isHuman ? <Headphones className="size-3" /> : <Bot className="size-3" />}
                    </div>
                    <div className={`p-2.5 rounded-2xl ${isVisitor ? "bg-neutral-100 dark:bg-neutral-800 rounded-tl-none" : isHuman ? "bg-purple-500 text-white rounded-tr-none" : "text-white rounded-tr-none"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
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
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="p-3 border-t border-neutral-100 dark:border-neutral-850 flex gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply (this takes over from AI)…"
                className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none" />
              <button type="submit" disabled={sending || !reply.trim()} style={{ background: color }} className="size-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 shrink-0">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
