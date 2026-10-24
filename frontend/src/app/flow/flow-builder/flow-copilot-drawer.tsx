"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  CheckCircle2,
  ArrowRight,
  Bot,
  User,
  RotateCcw,
  Wand2,
  AlertCircle,
  FileCheck,
  Check,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { chattyRequest } from "./lib";
import type { FlowData, FlowNode, FlowEdge } from "./types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string;
  action?: string;
  proposedFlow?: FlowData;
  proposedName?: string;
  changesSummary?: string[];
  applied?: boolean;
}

interface FlowCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  botId: string | null;
  flowId: string | null;
  flowName: string;
  currentGraph: FlowData;
  onApplyGraph: (next: FlowData, newName?: string, note?: string) => void;
  onAutoLayout: () => void;
  onPublishDraft: () => void;
}

const QUICK_PROMPTS = [
  { label: "🚀 Lead qualification flow", prompt: "Build a lead qualification flow that listens for new leads, replies to the visitor, and routes enterprise leads to email & Slack." },
  { label: "💬 AI intent classifier", prompt: "Add an AI classification step that sorts user messages into sales, support, or billing and replies appropriately." },
  { label: "📧 Booking confirmation & email", prompt: "Create a meeting booked flow: send a chat confirmation, wait 1 hour, and dispatch an email reminder." },
  { label: "🛠️ Auto-fix validation issues", prompt: "Analyze the current workflow, fix any missing triggers or fields, and connect orphaned nodes into a valid DAG." },
  { label: "📐 Auto-arrange layout", prompt: "Please clean up and re-align all nodes on a tidy grid layout with no overlapping lines." },
  { label: "📖 Explain this workflow", prompt: "Explain step-by-step how this workflow executes, its decision branches, and recommendations for improvements." },
];

export function FlowCopilotDrawer({
  isOpen,
  onClose,
  botId,
  flowId,
  flowName,
  currentGraph,
  onApplyGraph,
  onAutoLayout,
  onPublishDraft,
}: FlowCopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am your **Chatty Automation Architect**. I can build multi-step workflows from scratch, add AI decision branches, auto-fix configuration issues, or optimize your layout. What would you like to automate today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string>("Loading model...");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botId) return;
    void chattyRequest(`/api/flow-builder/ai/config?bot_id=${encodeURIComponent(botId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { display_name?: string };
        if (data.display_name) setActiveModel(data.display_name);
      })
      .catch(() => setActiveModel("Gemini 2.5 Flash"));
  }, [botId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const prompt = (textToSend ?? input).trim();
    if (!prompt || loading) return;
    if (!botId) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: "Please open this builder from an active bot to use the AI Copilot." },
      ]);
      return;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await chattyRequest("/api/flow-builder/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          bot_id: botId,
          flow_id: flowId,
          message: prompt,
          flow_data: currentGraph,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const errDetail = await res.text();
        throw new Error(errDetail.slice(0, 200) || "Agent request failed");
      }

      const data = await res.json() as {
        thought?: string;
        action?: string;
        message?: string;
        flow_name?: string;
        flow_data?: FlowData;
        changes_summary?: string[];
        llm_used?: string;
      };

      if (data.llm_used) setActiveModel(data.llm_used);

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.message || "I have analyzed and prepared the workflow changes.",
        thought: data.thought,
        action: data.action,
        proposedFlow: data.flow_data,
        proposedName: data.flow_name,
        changesSummary: data.changes_summary,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Unable to complete request: ${err instanceof Error ? err.message : "Network error"}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function applyProposal(msgId: string, proposedFlow?: FlowData, proposedName?: string) {
    if (!proposedFlow) return;
    onApplyGraph(proposedFlow, proposedName, "Applied from AI Copilot");
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  }

  if (!isOpen) return null;

  return (
    <aside className="flow-copilot-drawer" role="complementary" aria-label="Flow AI Copilot">
      <div className="flow-copilot-header">
        <div className="flex items-center gap-2">
          <div className="flow-copilot-badge">
            <Sparkles size={16} className="text-amber-500" />
          </div>
          <div>
            <h3 className="flow-copilot-title">Flow Architect AI</h3>
            <span className="flow-copilot-model" title="LLM selected in agent settings">
              <span className="status-dot-green" />
              {activeModel}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close AI Copilot"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flow-copilot-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`flow-copilot-bubble ${msg.role}`}>
            <div className="flow-copilot-bubble-meta">
              {msg.role === "assistant" ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Sparkles size={12} />
                  <span>Flow Architect</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <User size={12} />
                  <span>You</span>
                </div>
              )}
            </div>

            {msg.thought && (
              <div className="flow-copilot-thought">
                <small>Agent Reasoning:</small>
                <p>{msg.thought}</p>
              </div>
            )}

            <div className="flow-copilot-content">
              {msg.content}
            </div>

            {msg.proposedFlow && msg.proposedFlow.nodes?.length > 0 && (
              <div className="flow-copilot-proposal-card">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200 dark:border-neutral-800">
                  <strong className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {msg.proposedName || "Proposed Workflow"}
                  </strong>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {msg.proposedFlow.nodes.length} nodes · {msg.proposedFlow.edges.length} edges
                  </span>
                </div>

                {msg.changesSummary && msg.changesSummary.length > 0 && (
                  <ul className="flow-copilot-changes-list">
                    {msg.changesSummary.map((change, i) => (
                      <li key={i}>
                        <CheckCircle2 size={11} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className={`flow-copilot-apply-btn ${msg.applied ? "applied" : ""}`}
                    onClick={() => applyProposal(msg.id, msg.proposedFlow, msg.proposedName)}
                    disabled={msg.applied}
                  >
                    {msg.applied ? (
                      <>
                        <Check size={13} />
                        <span>Applied to Canvas</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Apply to Canvas</span>
                      </>
                    )}
                  </button>
                  {msg.action === "publish" && (
                    <button
                      type="button"
                      className="flow-copilot-publish-btn"
                      onClick={onPublishDraft}
                    >
                      <ArrowRight size={13} />
                      <span>Publish Now</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flow-copilot-bubble assistant">
            <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
              <Loader2 size={14} className="spin text-amber-500" />
              <span>Architect is designing workflow with {activeModel}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flow-copilot-suggestions">
        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">
          Quick Actions:
        </span>
        <div className="flow-copilot-chips">
          {QUICK_PROMPTS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="flow-copilot-chip"
              onClick={() => handleSend(q.prompt)}
              disabled={loading}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flow-copilot-input-bar">
        <textarea
          className="flow-copilot-input"
          placeholder="Ask AI to build, edit, or fix a workflow..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="flow-copilot-send-btn"
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          aria-label="Send prompt to AI Copilot"
        >
          {loading ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
    </aside>
  );
}
